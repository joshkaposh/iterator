export function swap<T>(array: T[], from_index: number, to_index: number) {
    const temp = array[to_index];
    array[to_index] = array[from_index];
    array[from_index] = temp;
}

export function swap_remove<T>(array: T[], i: number) {
    if (array.length > 0 && i !== array.length - 1) {
        swap(array, i, array.length - 1)
        return array.pop()
    } else {
        return array.pop();
    }
}

export function reserve(array: any[], additional: number) {

}
