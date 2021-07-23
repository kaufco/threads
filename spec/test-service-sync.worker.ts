import { dispatchRmiRequestsSync } from '../lib';
import { TestServiceImpl } from './TestServiceImpl';

dispatchRmiRequestsSync(new TestServiceImpl());
