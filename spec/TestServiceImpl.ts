import { TestService } from './test-service.definitions';
import { delay } from '../lib';

export class TestServiceImpl implements TestService {
    id = 'cafebabe';

    async getId(): Promise<string> {
        await delay(0.2);
        return this.id;
    }

    async setId(id: string): Promise<void> {
        this.id = id;
    }

    async sumNumList(list: number[]): Promise<number> {
        return list.reduce((acc, it) => acc + it);
    }

    async incAndGet(value: number): Promise<number> {
        return Promise.resolve(value + 1);
    }

    async throwFooError(): Promise<void> {
        throw new Error('foo');
    }

    async foo(bar: number, a: Int16Array, b: OffscreenCanvas): Promise<string> {
        return '' + bar + a.length + a[3] + b.width + b.height;
    }

    async bar(bar: number, a: Int16Array): Promise<string> {
        return '' + bar + a.length + a[4];
    }

    async get128By64OffscreenCanvas(): Promise<OffscreenCanvas> {
        return new OffscreenCanvas(128, 64);
    }
}
