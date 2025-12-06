import { Logger } from "@nestjs/common";
import axios, { AxiosAdapter, AxiosRequestConfig, AxiosResponse } from "axios";
import type { InternalAxiosRequestConfig } from "axios";
import { SsrfPolicyService } from "../policy/ssrf-policy.service";

const logger = new Logger('SecureAxiosAdapter');
const httpAdapter: AxiosAdapter = axios.getAdapter('http');

// Redirect status codes
const REDIRECT_CODES = [301, 302, 303, 307, 308];

export function createSecurityAxiosAdapter(
    ssrfPolicy: SsrfPolicyService,
): AxiosAdapter {
    return async function securityAxiosAdapter(config: AxiosRequestConfig): Promise<AxiosResponse> {
        const maxRedirects = config.maxRedirects ?? ssrfPolicy.getSecurityRules().ssrf.maxRedirects;
        
        let currentUrl = config.baseURL
            ? new URL(config.url!, config.baseURL).toString()
            : config.url!;

        if (!currentUrl) {
            return httpAdapter(config as InternalAxiosRequestConfig);
        }

        // Validate initial URL (with DNS check for private IPs)
        logger.debug(`Validating initial URL: ${currentUrl}`);
        await ssrfPolicy.validateUrlOrThrow(currentUrl);
        logger.debug(`Initial URL validated: ${currentUrl}`);

        let redirectCount = 0;
        let currentConfig: AxiosRequestConfig = { 
            ...config, 
            url: currentUrl,
            maxRedirects: 0,  // Disable auto-redirects
            validateStatus: () => true  // Accept all status codes
        };

        while (true) {
            const response = await httpAdapter(currentConfig as InternalAxiosRequestConfig);

            // Check if redirect
            if (REDIRECT_CODES.includes(response.status) && response.headers.location) {
                redirectCount++;

                if (redirectCount > maxRedirects) {
                    throw new Error(`Maximum redirects (${maxRedirects}) exceeded`);
                }

                // Resolve redirect URL (can be relative)
                const redirectUrl = new URL(response.headers.location, currentUrl).toString();
                
                logger.debug(`Redirect ${redirectCount}/${maxRedirects}: ${currentUrl} → ${redirectUrl}`);

                // Validate redirect URL (DNS check for private IPs)
                await ssrfPolicy.validateUrlOrThrow(redirectUrl);

                // Update for next iteration
                currentUrl = redirectUrl;
                currentConfig = {
                    ...currentConfig,
                    url: redirectUrl,
                    // For 303: change method to GET
                    method: response.status === 303 ? 'GET' : currentConfig.method,
                };
                continue;
            }

            // Not a redirect - return response
            // Restore original validateStatus behavior
            if (config.validateStatus && !config.validateStatus(response.status)) {
                const error = new Error(`Request failed with status code ${response.status}`) as any;
                error.response = response;
                error.config = config;
                throw error;
            }

            return response;
        }
    };
}