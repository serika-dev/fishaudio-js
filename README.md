# Fish Audio SDK

> **Note:** An official fish.audio JS library has been released: [fish-audio](https://www.npmjs.com/package/fish-audio). This SDK remains maintained with additional features and fixes.

Unofficial JavaScript/TypeScript SDK for [Fish Audio API](https://docs.fish.audio).

## Changelog

### v2025.11.29
- **Fixed:** Voice model creation (`createModel`) now works correctly in Node.js environments
- **Fixed:** Replaced browser `Blob` API with Node.js-compatible `form-data` package for file uploads
- **Fixed:** Added proper multipart/form-data headers for model creation and updates

## Install

```bash
npm install fish-audio-sdk
# or
bun add fish-audio-sdk
# or  
yarn add fish-audio-sdk
```

## Usage

Initialize a `Session` to use APIs. All APIs use async/await patterns.

```typescript
import { Session } from 'fish-audio-sdk';

const session = new Session("your_api_key");
```

You can change the endpoint and developer ID if needed:

```typescript
const session = new Session("your_api_key", "https://your-proxy-domain");

// Or specify a custom developer ID (defaults to My developer ID)
const session = new Session("your_api_key", "https://api.fish.audio", "your_developer_id");
```

Remember to clean up when you're done to prevent memory leaks:

```typescript
// Always close the session when done to clean up HTTP connections
session.close();
```

## Developer Program

This SDK automatically includes a developer ID in all requests to support the [Fish Audio Developer Program](https://docs.fish.audio/developer-plan). By default, it uses Fish Audio's developer ID, but you can specify your own:

```typescript
// Uses default developer ID (Mine)
const session = new Session("your_api_key");

// Use your own developer ID to earn commissions
const session = new Session("your_api_key", "https://api.fish.audio", "your_developer_id");
```

The developer ID is automatically added as a `developer-id` header to all API requests, allowing you to earn commissions when users consume Fish Audio services through your integration.

## Text to Speech (TTS)

```typescript
import { Session, TTSRequest } from 'fish-audio-sdk';
import * as fs from 'fs';

const session = new Session("your_api_key");

try {
  // Basic usage with required model header
  const writeStream = fs.createWriteStream("output.mp3");
  const ttsHeaders = { model: 'speech-1.5' }; // Required model header
  
  for await (const chunk of session.tts(new TTSRequest("Hello, world!"), ttsHeaders)) {
    writeStream.write(chunk);
  }
  writeStream.end();
} finally {
  // Always clean up connections
  session.close();
}

// With advanced options
const request = new TTSRequest("Hello, world!", {
  format: "mp3",           // 'wav' | 'pcm' | 'mp3' | 'opus'
  mp3Bitrate: 128,         // 64 | 128 | 192
  opusBitrate: 32,         // -1000 (auto), 24, 32, 48, 64 
  sampleRate: 44100,       // Sample rate in Hz
  chunkLength: 200,        // 100-300
  normalize: true,         // Audio normalization
  latency: "balanced",     // 'normal' | 'balanced'
  referenceId: "model_id", // Use a specific reference/voice model
  prosody: {
    speed: 1.0,            // Speech speed
    volume: 0.0            // Volume adjustment
  }
});

// Specify TTS model
const modelHeaders = { 
  model: 'speech-1.5'      // Available: 'speech-1.5', 'speech-1.6', 'agent-x0'
};

for await (const chunk of session.tts(request, modelHeaders)) {
  // Process each audio chunk
}
```

## Real-time TTS with WebSocket

For streaming text-to-speech in real-time:

```typescript
import { WebSocketSession, TTSRequest } from 'fish-audio-sdk';

const ws = new WebSocketSession("your_api_key");
// Or with custom endpoint and developer ID:
// const ws = new WebSocketSession("your_api_key", "wss://your-proxy-domain", "your_developer_id");

try {
  async function* textStream() {
    yield "First chunk of text";
    yield "Second chunk of text";
    // ...
  }

  const request = new TTSRequest("", {
    format: "mp3",
    latency: "balanced"
  });

  // Stream audio chunks as text is processed
  for await (const audioChunk of ws.tts(request, textStream())) {
    // Process audio chunk
  }
} finally {
  // Always close WebSocket when done
  await ws.close();
}
```

## Automatic Speech Recognition (ASR)

Convert audio to text with optional language detection:

```typescript
import { Session, ASRRequest } from 'fish-audio-sdk';
import * as fs from 'fs';

const session = new Session("your_api_key");
try {
  const audioBuffer = fs.readFileSync('audio.wav');

  const result = await session.asr(new ASRRequest(
    audioBuffer,
    "en",              // Optional: specify language
    false              // Optional: include timestamps
  ));

  console.log(result.text);      // Full transcription
  console.log(result.duration);  // Audio duration in seconds
  console.log(result.segments);  // Array of {text, start, end} segments
} catch (error) {
  // Handle API errors
  console.error('ASR Error:', error);
} finally {
  // Always clean up connections
  session.close();
}
```

## Voice Cloning and Model Management

### Create Voice Models

```typescript
import { Session } from 'fish-audio-sdk';
import * as fs from 'fs';

const session = new Session("your_api_key");

try {
  // Create a new voice model
  const voiceData = fs.readFileSync('voice_sample.wav');
  const model = await session.createModel({
    title: "My Voice Model",
    description: "Custom voice model",
    voices: [voiceData],
    texts: ["Text matching the voice sample"],
    tags: ["custom", "voice"],
    enhanceAudioQuality: true,
    visibility: "private", // 'public' | 'unlist' | 'private'
    type: "tts",
    trainMode: "fast"
  });

  console.log(`Model created with ID: ${model.id}`);
} finally {
  session.close();
}
```

### List and Filter Models

```typescript
const session = new Session("your_api_key");

try {
  // List models with pagination and filters
  const models = await session.listModels({
    pageSize: 10,
    pageNumber: 1,
    title: "search term",
    tag: ["tag1", "tag2"],
    self: true,               // Only show your models
    authorId: "user_id",
    language: ["en", "zh"],
    titleLanguage: "en",
    type: "tts",              // 'tts' or 'svc'
    sortBy: "created_at"      // 'score' | 'task_count' | 'created_at'
  });

  console.log(`Found ${models.total} models`);
  models.items.forEach(model => {
    console.log(`- ${model.title} (ID: ${model.id})`);
  });
} finally {
  session.close();
}
```

### Manage Models

```typescript
const session = new Session("your_api_key");

try {
  // Get specific model details
  const model = await session.getModel("model_id");
  console.log(model);

  // Update model properties
  await session.updateModel("model_id", {
    title: "Updated Title",
    description: "New description",
    visibility: "public",
    tags: ["updated", "tags"]
  });

  // Delete model
  await session.deleteModel("model_id");
} finally {
  session.close();
}
```

## Account and Wallet Management

Check API credits and package information:

```typescript
const session = new Session("your_api_key");

try {
  // Get API credit information
  const credits = await session.getApiCredit();
  console.log(`Available credits: ${credits.credit}`);
  console.log(`Has free credit: ${credits.has_free_credit}`);
  console.log(`Has phone verified: ${credits.has_phone_sha256}`);

  // Get premium package information
  const packageInfo = await session.getPackage();
  console.log(`Package type: ${packageInfo.type}`);
  console.log(`Balance: ${packageInfo.balance}/${packageInfo.total}`);
  console.log(`Expires: ${packageInfo.finished_at}`);
} finally {
  session.close();
}
```

## Error Handling

The SDK provides specific error types:

```typescript
import { 
  HttpCodeError,
  WebSocketError,
  AuthenticationError,
  PaymentRequiredError,
  NotFoundError
} from 'fish-audio-sdk';

const session = new Session("your_api_key");

try {
  await session.getModel("invalid_id");
} catch (error) {
  if (error instanceof PaymentRequiredError) {
    console.log(`Payment required: ${error.message}`);
  } else if (error instanceof AuthenticationError) {
    console.log(`Authentication failed: ${error.message}`);
  } else if (error instanceof NotFoundError) {
    console.log(`Resource not found: ${error.message}`);
  } else if (error instanceof HttpCodeError) {
    console.log(`HTTP Error ${error.status}: ${error.message}`);
  } else if (error instanceof WebSocketError) {
    console.log(`WebSocket Error: ${error.message}`);
  } else {
    console.log(`Unknown error: ${error}`);
  }
} finally {
  session.close();
}
```

## Supported Audio Formats

### Input (for ASR)
- WAV/PCM (16-bit, mono)
- MP3 (mono)

### Output (for TTS)
- WAV/PCM (Sample rates: 8kHz, 16kHz, 24kHz, 32kHz, 44.1kHz - default: 44.1kHz, 16-bit, mono)
- MP3 (Sample rates: 32kHz, 44.1kHz - default: 44.1kHz, mono, Bitrates: 64kbps, 128kbps, 192kbps)
- Opus (Sample rate: 48kHz, mono, Bitrates: -1000 (auto), 24kbps, 32kbps, 48kbps, 64kbps)

## Memory Management

To prevent memory leaks, always close sessions when done:

```typescript
// HTTP session
const session = new Session("your_api_key");
try {
  // Use session...
} finally {
  session.close(); // Clean up HTTP connections
}

// WebSocket session
const ws = new WebSocketSession("your_api_key");
try {
  // Use WebSocket...
} finally {
  await ws.close(); // Clean up WebSocket connections
}
```

## TTS Model Selection

Fish Audio offers different TTS models. Specify which one to use with the model header:

```typescript
// Available models:
// - speech-1.5 (default)
// - speech-1.6
// - agent-x0

const headers = { model: 'speech-1.5' };
for await (const chunk of session.tts(request, headers)) {
  // Process audio
}
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
