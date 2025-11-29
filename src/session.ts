import axios, { AxiosError, AxiosInstance } from 'axios';
import { TTSRequest, ASRRequest, ModelEntity, PaginatedResponse, APICreditEntity, PackageEntity, ASRResponse, ModelListParams, ModelCreateParams, ModelUpdateParams, ApiCreditParams } from './schemas';
import { HttpCodeError } from './exceptions';
import msgpack from 'msgpack-lite';
import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';
import FormData from 'form-data';

export class Session {
  private client: AxiosInstance;
  private httpAgent: HttpAgent;
  private httpsAgent: HttpsAgent;

  constructor(
    apiKey: string, 
    baseUrl: string = 'https://api.fish.audio',
    developerId: string = '6322d9df15d044e7b928de27c863480f'
  ) {
    // Create custom agents that can be destroyed later
    this.httpAgent = new HttpAgent({ keepAlive: true });
    this.httpsAgent = new HttpsAgent({ keepAlive: true });
    
    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'developer-id': developerId
      },
      timeout: 0,
      httpAgent: this.httpAgent,
      httpsAgent: this.httpsAgent
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      response => response,
      error => {
        if (error instanceof AxiosError && error.response) {
          // Extract more detailed error information if available
          const errorData = error.response.data;
          let errorDetail = error.response.statusText;
          
          if (typeof errorData === 'string') {
            errorDetail = errorData;
          } else if (errorData && typeof errorData === 'object') {
            errorDetail = errorData.detail || errorData.message || error.response.statusText;
          }
          
          throw new HttpCodeError(
            error.response.status,
            errorDetail
          );
        }
        throw error;
      }
    );
  }
  
  /**
   * Close all HTTP connections.
   * Call this method when you're done using the Session to prevent memory leaks.
   */
  close(): void {
    this.httpAgent.destroy();
    this.httpsAgent.destroy();
  }

  /**
   * Perform text-to-speech synthesis
   * @param request TTSRequest object with text and options
   * @param additionalHeaders Optional additional headers to include in the request
   * @returns AsyncGenerator yielding audio buffer chunks
   */
  async *tts(request: TTSRequest, additionalHeaders: Record<string, string> = {}): AsyncGenerator<Buffer> {
    try {
      // Log request details for debugging
      const requestPayload = request.toJSON();
      console.log('TTS Request:', JSON.stringify(requestPayload, null, 2));
      console.log('TTS Headers:', JSON.stringify(additionalHeaders, null, 2));
      
      // Use JSON format instead of MessagePack
      const response = await this.client.post('/v1/tts', 
        requestPayload,  // Send as JSON
        { 
          responseType: 'stream',
          headers: {
            'Content-Type': 'application/json',  // Changed from msgpack to json
            ...additionalHeaders
          }
        }
      );

      for await (const chunk of response.data) {
        yield Buffer.from(chunk);
      }
    } catch (error) {
      if (error instanceof HttpCodeError) {
        console.error(`TTS Error: ${error.status}: ${error.message}`);
      } else {
        console.error('TTS Error:', error instanceof Error ? error.message : error);
      }
      throw error;
    }
  }

  async asr(request: ASRRequest): Promise<ASRResponse> {
    try {
      const response = await this.client.post('/v1/asr',
        msgpack.encode(request.toJSON()),
        {
          headers: {
            'Content-Type': 'application/msgpack'
          }
        }
      );
      return ASRResponse.fromJSON(response.data);
    } catch (error) {
      if (error instanceof HttpCodeError) {
        console.error(`ASR Error: ${error.status}: ${error.message}`);
      } else {
        console.error('ASR Error:', error instanceof Error ? error.message : error);
      }
      throw error;
    }
  }

  async listModels(params: ModelListParams = {}): Promise<PaginatedResponse<ModelEntity>> {
    // Transform parameters to match API naming convention
    const apiParams: Record<string, any> = {};
    
    if (params.pageSize !== undefined) apiParams.page_size = params.pageSize;
    if (params.pageNumber !== undefined) apiParams.page_number = params.pageNumber;
    if (params.title !== undefined) apiParams.title = params.title;
    if (params.tag !== undefined) apiParams.tag = params.tag;
    if (params.self !== undefined) apiParams.self = params.self;
    if (params.authorId !== undefined) apiParams.author_id = params.authorId;
    if (params.language !== undefined) apiParams.language = params.language;
    if (params.titleLanguage !== undefined) apiParams.title_language = params.titleLanguage;
    if (params.sortBy !== undefined) apiParams.sort_by = params.sortBy;
    
    const response = await this.client.get('/model', { params: apiParams });
    
    // Transform response items to ensure consistent ID field
    const items = response.data.items.map((item: any) => ({
      ...item,
      id: item._id || item.id
    }));
    
    return {
      total: response.data.total,
      items
    };
  }

  async getModel(modelId: string): Promise<ModelEntity> {
    const response = await this.client.get(`/model/${modelId}`);
    return {
      ...response.data,
      id: response.data._id || response.data.id
    };
  }

  async createModel(params: ModelCreateParams): Promise<ModelEntity> {
    const formData = new FormData();
    
    // Add file data - use Buffer directly for Node.js compatibility
    params.voices.forEach((voice, i) => {
      formData.append('voices', voice, {
        filename: `voice_${i}.wav`,
        contentType: 'audio/wav'
      });
    });
    
    if (params.coverImage) {
      formData.append('cover_image', params.coverImage, {
        filename: 'cover.png',
        contentType: 'image/png'
      });
    }

    // Add other fields
    formData.append('visibility', params.visibility || 'private');
    formData.append('type', params.type || 'tts');
    formData.append('title', params.title);
    if (params.description) formData.append('description', params.description);
    formData.append('train_mode', params.trainMode || 'fast');
    if (params.texts) params.texts.forEach(text => formData.append('texts', text));
    if (params.tags) params.tags.forEach(tag => formData.append('tags', tag));
    formData.append('enhance_audio_quality', String(params.enhanceAudioQuality ?? true));

    const response = await this.client.post('/model', formData, {
      headers: {
        ...formData.getHeaders()
      }
    });
    return {
      ...response.data,
      id: response.data._id || response.data.id
    };
  }

  async deleteModel(modelId: string): Promise<void> {
    await this.client.delete(`/model/${modelId}`);
  }

  async updateModel(modelId: string, params: ModelUpdateParams): Promise<void> {
    const formData = new FormData();
    
    if (params.coverImage) {
      formData.append('cover_image', params.coverImage, {
        filename: 'cover.png',
        contentType: 'image/png'
      });
    }

    if (params.title) formData.append('title', params.title);
    if (params.description) formData.append('description', params.description);
    if (params.visibility) formData.append('visibility', params.visibility);
    if (params.tags) params.tags.forEach(tag => formData.append('tags', tag));

    await this.client.patch(`/model/${modelId}`, formData, {
      headers: {
        ...formData.getHeaders()
      }
    });
  }

  async getApiCredit(params: ApiCreditParams = {}): Promise<APICreditEntity> {
    const apiParams: Record<string, any> = {};
    
    if (params.checkFreeCredit !== undefined) {
      apiParams.check_free_credit = params.checkFreeCredit;
    }
    
    const response = await this.client.get('/wallet/self/api-credit', { params: apiParams });
    return response.data;
  }

  async getPackage(): Promise<PackageEntity> {
    const response = await this.client.get('/wallet/self/package');
    return response.data;
  }

} 