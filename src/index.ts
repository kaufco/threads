import { EnvType, envType, requireNodeModuleAtRuntime } from '@kobayami/env-utils';
import { invalidState } from '@kobayami/guards';

/**
 * Context for resolving or rejecting a promise.
 *
 * @example
 *
 * ```ts
 * const pending: Deferred<T>[] = [];
 *
 * function consume(): Promise<T> {
 *     return new Promise(
 *         (resolve, reject) => pending.push({resolve, reject})
 *     );
 * }
 *
 * function produce(value: T) {
 *     const deferred = pending.shift();
 *     // Assuming that produce is called after consume to keep the example simple:
 *     if (!deferred) throw invalidState();
 *     deferred.resolve(value);
 * }
 * ```
 *
 * @template T type of value to which the promise resolves
 */
export interface Deferred<T> {
    /**
     * Resolves the promise with the given value.
     */
    resolve: (value?: T | PromiseLike<T>) => void;

    /**
     * Rejects the promise with the given reason.
     */
    reject: (reason?: any) => void;
}

/**
 * Executes asynchronous, parameterless functions in sequence.
 *
 * When a function is enqueued in a `SequentialExecutor`, it will be called
 * after the promise returned by the previous function has been finished (i.e., resolved or rejected).
 *
 * This means that functions called via a `SequentialExecutor` are executed mutual exclusive
 * and cannot inflict race conditions over each other.
 *
 * @example
 *
 * ```ts
 * let counter = 0;
 *
 * async function count() {
 *     for (let i = 0; i < 10; i++) {
 *         await delay(0.1);
 *         counter++;
 *     }
 * }
 *
 * async function printCount() {
 *     console.log('count: '+count);
 * }
 *
 * const executor = new SequentialExecutor();
 *
 * executor.enqueue(count);
 * executor.enqueue(printCount);
 * console.log('first line');
 * // Prints 10 instead of 0, and prints "first line" before the number.
 * ```
 */
export class SequentialExecutor {
    private chain: Promise<any> = Promise.resolve();

    /**
     * Enqueues an asynchronous, parameterless function for sequential execution
     * and returns a promise that will be resolved with the function return value.
     *
     * @param f function to be executed
     * @template T type of value to which the promise resolves
     */
    enqueue<T>(f: () => Promise<T>): Promise<T> {
        return (this.chain = this.chain.finally(() => f()));
    }
}

/**
 * Minimal message port interface required by this module for remote method invocation (RMI).
 *
 * Covers the Web API as well as the NodeJS API.
 * Web `Worker`, `ServiceWorker` and `MessagePort`, as well as NoeJS `Worker` and `parentPort`
 * are assignment compatible with this interface.
 */
export interface WebOrNodeRmiPort {
    /**
     * Web API: assigned event handler for the `message` event.
     */
    onmessage?: ((ev: MessageEvent) => any) | null;

    /**
     * NodeJS API: function to register the event handler for the `message` event.
     */
    readonly on?: (event: 'message' | any, listener: (value: any) => void) => this;

    /**
     * Post a message on this port.
     *
     * @param message message data
     * @param transfer list of transfer objects
     */
    postMessage(message: any, transfer?: Transferable[]): void;
}

/**
 * Creates an RMI proxy for the given service interface.
 * The service functions can then be called on the proxy instance directly.
 *
 * The proxy will delegate the calls via message passing
 * to the actual service that listens to the given port.
 * This can, for example, be an instance of a worker thread.
 *
 * Transfer objects, such as the `OffscreenCanvas` instance in the example,
 * are handled automatically by the proxy and need not to be specified explicitly.
 * However, only function arguments and function return values are allowed to be transfer objects.
 * Transfer objects will not work if they are embedded deeper in the object structure.
 *
 * @example
 *
 * ```ts
 * interface RenderService {
 *     enable(surface: OffscreenCanvas): Promise<void>;
 *     setMaxFps(value: number): Promise<void>;
 *     getCurrentFps(): Promise<number>;
 * }
 *
 * const renderService = createServiceRmiProxy<RenderService>(
 *     startWorker('./render.worker')
 * );
 *
 * renderService.enable(new OffscreenCanvas(640, 480));
 * ```
 *
 * @param port message port through which to delegate RMI requests
 *
 * @template ServiceInterface interface declaration of the service; should contain asynchronous methods only
 */
export function createServiceRmiProxy<ServiceInterface extends object>(port: WebOrNodeRmiPort): ServiceInterface {
    const rmiAdapter = new RmiAdapter(port);
    const functionProxies: { [key: string]: (...args: any) => any } = {};

    return new Proxy<ServiceInterface>({} as ServiceInterface, {
        get: (target: ServiceInterface, p: PropertyKey) => {
            const name = p as string;
            return (
                functionProxies[name] || (functionProxies[name] = (...args: any) => rmiAdapter.callByName(name, args))
            );
        },
    });
}

/**
 * Starts a new worker thread.
 *
 * The purpose of this function is to provide an abstraction method
 * for instantiating worker threads which works in both, Web and NodeJS environments.
 *
 * ```ts
 * const renderService = createServiceRmiProxy<RenderService>(
 *     startWorker('./render.worker')
 * );
 *
 * renderService.enable(new OffscreenCanvas(640, 480));
 * ```
 *
 * @param path path or URL to the script to be executed in the worker thread
 */
export function startWorker(path: string): WebOrNodeRmiPort {
    const WorkerClass = envType === EnvType.NODE ? getNodeJsWorkerThreadsModule().Worker : Worker;
    return new WorkerClass(path);
}

/**
 * Listens for RMI requests on the given message port and delegates them
 * to methods of the given service instance in sequence.
 *
 * This means that on the service side, a service function is invoked only
 * after the promise returned by the previous function has been finished (i.e., resolved or rejected),
 * regardless on whether the proxy functions are also invoked in sequence or not.
 *
 * Effectively this means that the service implementation does not need to take care of race conditions
 * that result from asynchronous service function calls, because the functions are executed mutually exclusive.
 *
 * @example
 *
 * ```ts
 * class SyncRenderServiceImpl implements RenderService {
 *
 *     async enable(surface: OffscreenCanvas): Promise<void> {
 *         // Object state of `this` can safely be changed without race conditions.
 *         ...
 *     }
 *
 *     async setMaxFps(value: number): Promise<void> {
 *         // Object state of `this` can safely be changed without race conditions.
 *         ...
 *     }
 *
 *     async getCurrentFps(): Promise<number> {
 *         // Object state of `this` can safely be changed without race conditions.
 *         ...
 *     }
 * }
 *
 * dispatchRmiRequestsSync(new SyncRenderServiceImpl());
 * ```
 *
 * @param port message port on which to listen for RMI requests
 * @param service service instance to which to delegate function calls
 */
export function dispatchRmiRequestsSync(service: object, port?: WebOrNodeRmiPort): void {
    const definedPort = port || getWorkerRmiPort();
    const queue = new SequentialExecutor();
    setRmiMessageHandler(definedPort, (request: RMIRequest) => {
        const callee = (service as any)[request.functionName];
        ignorePromise(queue.enqueue(() => callService(request, definedPort, service, callee)));
    });
}

/**
 * Listens for RMI requests on the given message port and delegates them
 * to methods of the given service instance.
 *
 * On the service side, the service functions are invoked asynchronously,
 * which means that it is not guaranteed that
 * the promise returned by the previous function has yet been finished (i.e., resolved or rejected).
 *
 * Effectively this means that the service implementation must take care of race conditions
 * that result from asynchronous function calls, because
 * the service functions are not executed mutually exclusive.
 *
 * @example
 *
 * ```ts
 * class AsyncRenderServiceImpl implements RenderService {
 *
 *     async enable(surface: OffscreenCanvas): Promise<void> {
 *         // Be aware of race conditions when changing object state of `this`!
 *         ...
 *     }
 *
 *     async setMaxFps(value: number): Promise<void> {
 *         // Be aware of race conditions when changing object state of `this`!
 *         ...
 *     }
 *
 *     async getCurrentFps(): Promise<number> {
 *         // Be aware of race conditions when changing object state of `this`!
 *         ...
 *     }
 * }
 *
 * dispatchRmiRequestsAsync(new AsyncRenderServiceImpl());
 * ```
 *
 * @param service service instance to which to delegate function calls
 * @param port port on which to listen for RMI requests, or `undefined` if the default port should be used for a worker thread.
 */
export function dispatchRmiRequestsAsync(service: object, port?: WebOrNodeRmiPort): void {
    const definedPort = port || getWorkerRmiPort();
    setRmiMessageHandler(definedPort, (request: RMIRequest) => {
        const callee: (...args: any) => Promise<any> = (service as any)[request.functionName];
        ignorePromise(callService(request, definedPort, service, callee));
    });
}

/**
 * Returns the default message port on which a worker thread can listen for RMI requests.
 *
 * @example
 *
 * ```ts
 * // both calls are equivalent:
 * dispatchRmiRequestsSync(new RenderServiceImpl());
 * dispatchRmiRequestsSync(new RenderServiceImpl(), getWorkerRmiPort());
 * ```
 */
export function getWorkerRmiPort(): WebOrNodeRmiPort {
    return envType === EnvType.NODE ? getNodeJsWorkerThreadsModule().parentPort : self;
}

function getNodeJsWorkerThreadsModule(): any {
    return requireNodeModuleAtRuntime('worker_threads');
}

/**
 * An RMI request.
 */
interface RMIRequest {
    /**
     * ID of the request. For asynchronous requests, needed to identify the request.
     */
    requestId: number;

    /**
     * Name of the service function to call.
     */
    functionName: string;

    /**
     * Arguments to pass to the service function.
     */
    args: any[];
}

/**
 * Response for an RMI request.
 */
interface RMIResponse {
    /**
     * ID of the request. For asynchronous requests, needed to identify the request.
     */
    requestId: number;

    /**
     * Whether the request could be successfully processed.
     */
    success: boolean;

    /**
     * Response value. If the request could be processed successfully, then this property contains the function
     * return value. Otherwise, it contains the error object (usually an exception) that occurred on the server thread.
     */
    value: any;
}

function setRmiMessageHandler(
    port: WebOrNodeRmiPort,
    onMessage: ((request: RMIRequest) => any) | ((response: RMIResponse) => any),
): void {
    if (port.on) {
        // NodeJS API
        port.on('message', onMessage);
    } else {
        // Browser API
        port.onmessage = (ev: MessageEvent<RMIRequest | RMIResponse>) => onMessage(ev.data as any);
    }
}

/**
 * An adapter that translates function calls into RMI requests.
 */
class RmiAdapter {
    /**
     * Pending requests that have not yet been finished by the service.
     */
    pendingRequests: { [key: string]: Deferred<any> } = {};

    /**
     * Running ID to identify the request.
     */
    requestId = 0;

    constructor(private port: WebOrNodeRmiPort) {
        setRmiMessageHandler(port, (response: RMIResponse) => this.dispatch(response));
    }

    /**
     * Calls the given function on the server site.
     *
     * Returns a promise that resolves with the return value of the function.
     *
     * @param functionProxy proxy for the server-site function
     * @param args arguments for the function call
     */
    public call<T>(functionProxy: (...args: any) => Promise<T>, args: IArguments): Promise<T> {
        return this.callByName(functionProxy.name, args);
    }

    /**
     * Calls the function with the given name on the server site.
     *
     * Returns a promise that resolves with the return value of the function.
     *
     * @param functionName name of the server-site function
     * @param args arguments for the function call
     */
    public callByName<T>(functionName: string, args: IArguments): Promise<T> {
        const requestId = this.requestId++;
        this.port.postMessage(
            {
                requestId,
                functionName,
                args: [...args],
            },
            extractTransferList(args),
        );
        return new Promise((resolve, reject) => {
            this.pendingRequests[requestId] = {
                resolve,
                reject,
            };
        });
    }

    /**
     * Dispatches a message from the server site and resolves or rejects the corresponding promise.
     *
     * @param response response of an RMI request
     */
    private dispatch(response: RMIResponse): void {
        const deferred = this.pendingRequests[response.requestId];
        if (!deferred) throw invalidState();
        delete this.pendingRequests[response.requestId];
        if (response.success) {
            deferred.resolve(response.value);
        } else {
            deferred.reject(response.value);
        }
    }
}

function callService(
    request: RMIRequest,
    port: WebOrNodeRmiPort,
    service: object,
    callee: (...args: any) => Promise<any>,
): Promise<void> {
    return callee.apply(service, request.args).then(
        (value) => postResponse(port, request.requestId, true, value),
        (reason) => postResponse(port, request.requestId, false, reason),
    );
}

function postResponse(port: WebOrNodeRmiPort, requestId: number, success: boolean, value: any): void {
    port.postMessage(
        {
            requestId,
            success,
            value,
        },
        appendOrCreateIfTransferType(value),
    );
}

/**
 * Extracts the list of transfer objects from the given function arguments and returns them in an array.
 *
 * @param args function arguments.
 */
function extractTransferList(args: IArguments): Transferable[] | undefined {
    let transfer: Transferable[] | undefined = void 0;
    for (const arg of args) {
        transfer = appendOrCreateIfTransferType(arg, transfer);
    }
    return transfer;
}

/**
 * If the given argument is of a transfer type, adds it to the given array and returns the array,
 * or returns `[arg]`, if `transfer === undefined`.
 * Performs no action otherwise.
 */
function appendOrCreateIfTransferType(arg: any, transfer?: Transferable[]): Transferable[] | undefined {
    return isTransferType(arg) ? appendOrCreateArray(arg as Transferable, transfer) : transfer;
}

function isTransferType(arg: object): boolean {
    const typeName = arg?.constructor?.name;
    return (
        typeName === 'ArrayBuffer' ||
        typeName === 'MessagePort' ||
        typeName === 'ImageBitmap' ||
        typeName === 'OffscreenCanvas'
    );
}

function appendOrCreateArray<T>(element: T, array?: T[]): T[] {
    if (!array) return [element];
    array.push(element);
    return array;
}

/**
 * Ignores a promise intentionally.
 *
 * @param _ Promise to be ignored
 */
// tslint:disable-next-line:no-empty
function ignorePromise(_: Promise<any>): void {}

/**
 * Returns a promise that resolves after the given number of seconds.
 *
 * @example
 *
 * ```ts
 * async function mySequence(): Promise<void> {
 *     console.log('foo');
 *     await delay(1.0);
 *     console.log('bar');
 *     await delay(1.0);
 *     console.log('baz');
 *     await delay(1.0);
 * }
 * ```
 *
 * @param seconds delay time in seconds
 */
export async function delay(seconds: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve();
        }, seconds * 1000);
    });
}
