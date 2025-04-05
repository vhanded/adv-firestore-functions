## I am not longer keeping up with this project, so feel free to fork it!

Please check my website [Fireblog.io](https://fireblog.io) for updates. 

_______

# Advanced Firestore Functions

These are the back-end firestore functions that will allow you to create easy-to-use indexes. 

**Installation**

Install the package into your **firebase functions** directory.

```npm i adv-firestore-functions```

Import the necessary functions at the top of your firebase function file:

```typescript
import { eventExists, fullTextIndex } from 'adv-firestore-functions';
```

All of these functions are called on an **async onWrite** firebase firestore function like so:

```typescript
functions.firestore
    .document('posts/{docId}')
    .onWrite(async (change: any, context: any) => {
//... code
}
```

The search functions, however, must be put in a callable function like so:

```typescript
functions.https.onCall(async (q: any) => {

// 'q' is the data coming in

//... code
}
```
# DOCS

- [Searching](SEARCHING.md)
- [Counters](COUNTERS.md)
- [Aggregation](AGGREGATION.md)
- [Helper Functions](HELPER.md)
- [Search Module](#search-module)

If you see any errors or have any suggestions, please post an [issue on github](https://github.com/jdgamble555/adv-firestore-functions/issues).

There is more to come as I simplify my firebase functions!
See [Fireblog.io][1] for more examples (whenever I finally update it)!

## Search Module

The `search.ts` module provides advanced search and indexing capabilities for Firestore. Below are the key functions:

### `relevantIndex`
Indexes Firestore documents for relevance-based search.

**Options:**
- **`fieldsToIndex`**: An array of fields to index.
- **`customKeywords`**: An array of custom keywords to include in the index.
- **`mergeFields`**: Whether to combine fields into one collection (default: `true`).
- **Other options**: Includes `rootCollectionPath`, `searchCollectionName`, `numWords`, `mergedCollectionName`, and `termField`.

**Usage:**
```typescript
await relevantIndex(change, context, {
  fieldsToIndex: ['title', 'description'],
  customKeywords: ['custom1', 'custom2'],
  mergeFields: true,
});
```

### `relevantSearch`
Performs a relevance-based search on indexed documents.

**Options:**
- **`query`**: The search query string.
- **`fieldsToSearch`**: An array of fields to search within (default: `['_merged']`).
- **`limit`**: Maximum number of results to return.
- **Other options**: Includes `rootCollectionPath`, `searchCollectionName`, `termField`, `filterFunc`, and `startId`.

**Usage:**
```typescript
const results = await relevantSearch({
  query: 'example query',
  fieldsToSearch: ['_merged'],
  limit: 10,
});
```

### `trigramIndex`
Indexes Firestore documents using trigrams for fuzzy search.

**Options:**
- **`fieldsToIndex`**: An array of fields to index.
- **`mergeFields`**: Whether to combine fields into one collection (default: `true`).
- **Other options**: Includes `rootCollectionPath`, `trigramCollectionName`, `mergedCollectionName`, and `termField`.

**Usage:**
```typescript
await trigramIndex(change, context, {
  fieldsToIndex: ['content'],
  mergeFields: true,
});
```

### `trigramSearch`
Performs a trigram-based fuzzy search on indexed documents.

**Options:**
- **`query`**: The search query string.
- **`fieldsToSearch`**: An array of fields to search within (default: `['_merged']`).
- **`limit`**: Maximum number of results to return.
- **Other options**: Includes `searchCollectionName` and `termField`.

**Usage:**
```typescript
const results = await trigramSearch({
  query: 'example',
  fieldsToSearch: ['_merged'],
  limit: 10,
});
```

### `fullTextIndex`
Indexes Firestore documents for full-text search.

**Options:**
- **`fieldToIndex`**: The field to index for full-text search.
- **Other options**: Includes `foreignKey`, `type`, `numChunks`, `searchCollectionName`, and `rootCollectionPath`.

**Usage:**
```typescript
await fullTextIndex(change, context, 'content');
```

[1]: http://fireblog.io "Fireblog.io"
