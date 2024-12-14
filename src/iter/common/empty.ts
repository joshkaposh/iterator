import { done } from "../../shared";
import { ExactSizeDoubleEndedIterator } from "../base/double-ended-iterator";

export class Empty<T> extends ExactSizeDoubleEndedIterator<T> {
    override into_iter(): ExactSizeDoubleEndedIterator<T> {
        return this;
    }

    override next(): IteratorResult<T> {
        return done()
    }

    override next_back(): IteratorResult<T> {
        return done()
    }
}

