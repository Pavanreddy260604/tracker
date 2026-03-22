export const difficultyColors: Record<string, string> = {
    easy: 'border-l-green-500',
    medium: 'border-l-amber-500',
    hard: 'border-l-red-500',
};

export const DSA_TOPIC_OPTIONS = [
    { value: '', label: 'All Topics' },
    { value: 'arrays', label: 'Arrays' },
    { value: 'strings', label: 'Strings' },
    { value: 'linked-list', label: 'Linked List' },
    { value: 'stack', label: 'Stack' },
    { value: 'queue', label: 'Queue' },
    { value: 'trees', label: 'Trees' },
    { value: 'graphs', label: 'Graphs' },
    { value: 'dp', label: 'Dynamic Programming' },
    { value: 'greedy', label: 'Greedy' },
    { value: 'backtracking', label: 'Backtracking' },
    { value: 'binary-search', label: 'Binary Search' },
    { value: 'two-pointers', label: 'Two Pointers' },
    { value: 'sliding-window', label: 'Sliding Window' },
    { value: 'hashing', label: 'Hashing' },
    { value: 'heap', label: 'Heap' },
    { value: 'trie', label: 'Trie' },
    { value: 'bit-manipulation', label: 'Bit Manipulation' },
    { value: 'math', label: 'Math' },
    { value: 'recursion', label: 'Recursion' },
    { value: 'sorting', label: 'Sorting' },
    { value: 'other', label: 'Other' },
];

const DSA_TOPIC_NORMALIZATION: Record<string, string> = {
    array: 'arrays',
    arrays: 'arrays',
    string: 'strings',
    strings: 'strings',
    'linked list': 'linked-list',
    linkedlist: 'linked-list',
    'linked-list': 'linked-list',
    stack: 'stack',
    queue: 'queue',
    tree: 'trees',
    trees: 'trees',
    graph: 'graphs',
    graphs: 'graphs',
    'dynamic programming': 'dp',
    dp: 'dp',
    greedy: 'greedy',
    backtracking: 'backtracking',
    'binary search': 'binary-search',
    'binary-search': 'binary-search',
    'two pointers': 'two-pointers',
    'two-pointers': 'two-pointers',
    'sliding window': 'sliding-window',
    'sliding-window': 'sliding-window',
    'priority queue': 'heap',
    heap: 'heap',
    trie: 'trie',
    'bit manipulation': 'bit-manipulation',
    'bit-manipulation': 'bit-manipulation',
    math: 'math',
    recursion: 'recursion',
    sorting: 'sorting',
    hashing: 'hashing',
    other: 'other',
};

export const normalizeDsaTopic = (topic?: string) => {
    const value = topic?.trim();
    if (!value) {
        return '';
    }

    return DSA_TOPIC_NORMALIZATION[value.toLowerCase()] ?? value.toLowerCase().replace(/\s+/g, '-');
};

export const TOPICS = DSA_TOPIC_OPTIONS;

export const DIFFICULTIES = [
    { value: '', label: 'All Difficulties' },
    { value: 'easy', label: 'Easy' },
    { value: 'medium', label: 'Medium' },
    { value: 'hard', label: 'Hard' },
];
