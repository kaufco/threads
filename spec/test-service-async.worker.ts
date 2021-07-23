import { dispatchRmiRequestsAsync } from '../lib';
import { TestServiceImpl } from './TestServiceImpl';

dispatchRmiRequestsAsync(new TestServiceImpl());
