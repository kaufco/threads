const path = require('path');

module.exports = [{
    name: 'browser-test',
    entry: './test/index.spec.js',
    mode: 'production',
    output: {
        path: path.resolve('test/browser'),
        filename: 'test.js'
    }
}, {
    name: 'browser-test-sync.worker',
    entry: './test/test-service-sync.worker.js',
    mode: 'production',
    output: {
        path: path.resolve('test/browser'),
        filename: 'test-service-sync.worker.js'
    }
}, {
    name: 'browser-test-async.worker',
    entry: './test/test-service-async.worker.js',
    mode: 'production',
    output: {
        path: path.resolve('test/browser'),
        filename: 'test-service-async.worker.js'
    }
}]
