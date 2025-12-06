import axios, { AxiosInstance } from "axios";
import { createSecurityAxiosAdapter } from "./security-axios.adapter";
import { SsrfPolicyService } from "../policy/ssrf-policy.service";
import { Injectable } from "@nestjs/common";

@Injectable()
export class SecureHttpClient {
    private readonly client: AxiosInstance;

    get: AxiosInstance['get'];
    post: AxiosInstance['post'];
    put: AxiosInstance['put'];
    delete: AxiosInstance['delete'];
    patch: AxiosInstance['patch'];
    options: AxiosInstance['options'];
    head: AxiosInstance['head'];

    constructor(
        private readonly ssrfPolicy: SsrfPolicyService,
    ) {
        this.client = axios.create({
            adapter: createSecurityAxiosAdapter(this.ssrfPolicy),
        });
        this.get = this.client.get.bind(this.client);
        this.post = this.client.post.bind(this.client);
        this.put = this.client.put.bind(this.client);
        this.delete = this.client.delete.bind(this.client);
        this.patch = this.client.patch.bind(this.client);
        this.options = this.client.options.bind(this.client);
        this.head = this.client.head.bind(this.client);
    }
}