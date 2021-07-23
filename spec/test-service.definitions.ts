export interface TestService {
    getId(): Promise<string>;
    setId(id: string): Promise<void>;
    sumNumList(list: number[]): Promise<number>;
    incAndGet(value: number): Promise<number>;
    throwFooError(): Promise<void>;
    foo(bar: number, a: Int16Array, b: OffscreenCanvas): Promise<string>;
    bar(bar: number, a: Int16Array): Promise<string>;
    get128By64OffscreenCanvas(): Promise<OffscreenCanvas>;
}
