import { TestService } from './test-service.definitions';
import { createServiceRmiProxy, startWorker } from '../lib';
import { EnvType, envType } from '@kobayami/env-utils';

describe('Test Suite', () => {
    it('Basic RMI: service `this`, basic marshalling and unmarshalling', async () => {
        const renderService: TestService = createServiceRmiProxy(
            startWorker(getWorkerBasePath() + 'test-service-sync.worker.js'),
        );
        const unresolvedId = renderService.getId();
        renderService.setId('colasweetheart');
        // Note the difference to asynchronous execution: 'cafebabe' expected
        expect(await unresolvedId).toBe('cafebabe');
        expect(await renderService.getId()).toBe('colasweetheart');
        expect(await renderService.sumNumList([2, 3, 5, 7, 11])).toBe(28);
        expect(await renderService.incAndGet(41)).toBe(42);
    });

    it('Async RMI: service `this`, basic marshalling and unmarshalling', async () => {
        const renderService: TestService = createServiceRmiProxy(
            startWorker(getWorkerBasePath() + 'test-service-async.worker.js'),
        );
        const unresolvedId = renderService.getId();
        renderService.setId('colasweetheart');
        // Note the difference to asynchronous execution: 'colasweetheart' expected
        expect(await unresolvedId).toBe('colasweetheart');
        expect(await renderService.getId()).toBe('colasweetheart');
        expect(await renderService.sumNumList([2, 3, 5, 7, 11])).toBe(28);
        expect(await renderService.incAndGet(41)).toBe(42);
    });

    it('Basic RMI: worker exceptions and re-instantiation', async () => {
        const renderService: TestService = createServiceRmiProxy(
            startWorker(getWorkerBasePath() + 'test-service-sync.worker.js'),
        );
        expect(await renderService.getId()).toBe('cafebabe');
        renderService.setId('colasweetheart');
        expect(await renderService.getId()).toBe('colasweetheart');

        let exceptionState = 'not thrown';
        try {
            await renderService.throwFooError();
        } catch (e) {
            exceptionState = 'thrown';
            expect(e).toEqual(new Error('foo'));
        }
        expect(exceptionState).toBe('thrown');
    });

    it('Advanced RMI: transfer objects', async () => {
        const worker = startWorker(getWorkerBasePath() + 'test-service-sync.worker.js');
        const renderService: TestService = createServiceRmiProxy(worker);

        let buf = new Int16Array(16);
        buf[4] = 5533;
        let result = await renderService.bar(142, buf);
        expect(result).toBe('142165533');

        if (envType === EnvType.WEB) {
            buf = new Int16Array(10);
            buf[3] = 9999;
            const canvas = new OffscreenCanvas(320, 200);
            result = await renderService.foo(123, buf, canvas);
            expect(result).toBe('123109999320200');

            const workerCanvas = await renderService.get128By64OffscreenCanvas();
            expect(workerCanvas.width).toBe(128);
            expect(workerCanvas.height).toBe(64);
        }
    });
});

function getWorkerBasePath(): string {
    if (envType === EnvType.WEB) {
        // use Karma paths
        return './base/test/browser/';
    } else {
        // use normal script path
        return './test/';
    }
}
