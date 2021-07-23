# @kobayami/threads

## Installation

```sh
npm install --save @kobayami/threads
```

## Version and License

- Latest version: 1.0.0
- License: [MIT](https://kobayami.github.io/threads/LICENSE.md)
- [Changes](https://kobayami.github.io/threads/CHANGES.md)

## Summary

Enables direct function calls from main thread into worker threads instead of manual message passing.
This simplifies the usage of worker threads a lot!

This library works for both Web and NodeJS environments and provides a common adapter API
for the platform specific parts, so that the same application code can be run 
in both environments without modification.

Core features of this library include:

- Direct function calls from main thread into services run on worker threads
- Own very lightweight RMI protocol specifically for this purpose
- Automatic handling of transfer objects
- Support for synchronous and asynchronous service implementations 
- Compatible with Web and NodeJS environments

## Usage Example

Service interface:

```ts
interface RenderService {
    enable(surface: OffscreenCanvas): Promise<void>;
    getSurface(): Promise<OffscreenCanvas | null>;
    setMaxFps(value: number): Promise<void>;
    getCurrentFps(): Promise<number>;
}
```

Main thread (`main.js`), or client side:

```ts
const renderService = createServiceRmiProxy<RenderService>(
    startWorker('./render.worker')
);

renderService.enable(new OffscreenCanvas(640, 480));
const canvas = await renderService.getSurface();
renderservice.setMaxFps(60);
delay(10);
const currentFps = await renderService.getCurrentFps();
```

Worker thread (`render.worker.js`), or server side:

```ts
class RenderServiceImpl implements RenderService {

    surface: OffscreenCanvas | null = null;
  
    maxFps = 60;
    
    lastRenderCycleTimeMs = Number.MAX_VALUE;
    
    async enable(surface: OffscreenCanvas): Promise<void> {
        this.surface = surface;
        this.startRenderLoop();
    }

    async getSurface(): Promise<OffscreenCanvas | null> {
        return this.surface;
    }
    
    async setMaxFps(value: number): Promise<void> {
        this.maxFps = value;
    }

    async getCurrentFps(): Promise<number> {
        return 1000 / this.lastRenderCycleTimeMs;
    }
    
    private startRenderLoop() {
        ...
    }
}

dispatchRmiRequestsSync(new RenderServiceImpl());
```

## See Also

- [API Documentation](https://kobayami.github.io/threads/docs/modules.html)
- [Project Homepage](https://kobayami.github.io/threads)
- [Project on GitHub](https://github.com/kobayami/threads)
- [Issues](https://github.com/kobayami/threads/issues)
