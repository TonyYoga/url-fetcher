import { IsArray, ArrayNotEmpty, ArrayMaxSize, IsString } from 'class-validator'
import { MAX_URLS_PER_REQUEST } from 'src/common/constants'

export class CreateRequestDto {
    @IsArray()
    @ArrayNotEmpty()
    @ArrayMaxSize(MAX_URLS_PER_REQUEST)
    @IsString({ each: true})
    urls: string[]
}