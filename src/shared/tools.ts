import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
try {
  admin.initializeApp();
} catch (e) {
  /* empty */
}

export {
  ArrayChunk,
  getCatArray,
  arraysEqual,
  findSingleValues,
  canContinue,
  getFriendlyURL,
  isTriggerFunction,
  valueChange,
  triggerFunction,
  getValue,
  fkChange,
  aggregateData,
};
/**
 * Return a friendly url for the db
 * @param url
 */
function getFriendlyURL(url: string): string {
  // create friendly URL
  return url
    .trim()
    .toLowerCase()
    .replace(/^[^a-z\d]*|[^a-z\d]*$/gi, '') // trim other characters as well
    .replace(/-/g, ' ')
    .replace(/[^\w ]+/g, '')
    .replace(/ +/g, '-');
}
/**
 * Determines if is an update or create trigger function
 * @param after
 * @param before
 */
function canContinue(after: any, before: any): boolean {
  // if update trigger
  if (before.updatedAt && after.updatedAt) {
    if (after.updatedAt._seconds !== before.updatedAt._seconds) {
      return false;
    }
  }
  // if create trigger
  if (!before.createdAt && after.createdAt) {
    return false;
  }
  return true;
}
/**
 * Check for trigger function
 * @param change
 */
function isTriggerFunction(change: functions.Change<functions.firestore.DocumentSnapshot>, eventId: string) {
  // simplify input data
  const after: any = change.after.exists ? change.after.data() : null;
  const before: any = change.before.exists ? change.before.data() : null;

  const updateDoc = change.before.exists && change.after.exists;

  if (updateDoc && !canContinue(after, before)) {
    console.log('Trigger function run: ', eventId);
    return true;
  }
  return false;
}
/**
 * Gets the unique values from the combined array
 * @param a1
 * @param a2
 * @return - unique values array
 */
function findSingleValues(a1: any[], a2: any[]): any[] {
  return a1.concat(a2).filter((v: any) => {
    if (!a1.includes(v) || !a2.includes(v)) {
      return v;
    }
  });
}
/**
 * Determine if arrays are equal
 * @param a1
 * @param a2
 * @return - boolean
 */
function arraysEqual(a1: any[], a2: any[]): boolean {
  return JSON.stringify(a1) === JSON.stringify(a2);
}
/**
 * Returns the latest value of a field
 * @param change
 * @param val
 */
function getValue(change: functions.Change<functions.firestore.DocumentSnapshot>, val: string): string {
  // simplify input data
  const after: any = change.after.exists ? change.after.data() : null;
  const before: any = change.before.exists ? change.before.data() : null;

  return after ? after[val] : before[val];
}
/**
 * Determine if a field value has been updated
 * @param change
 * @param val
 */
function valueChange(change: functions.Change<functions.firestore.DocumentSnapshot>, val: string): boolean {
  // simplify input data
  const after: any = change.after.exists ? change.after.data() : null;
  const before: any = change.before.exists ? change.before.data() : null;

  if (!before || !after || !before[val] || !after[val]) {
    return true;
  }
  if (arraysEqual(before[val], after[val])) {
    return false;
  }
  return true;
}
/**
 * Returns the category array
 * @param category
 */
function getCatArray(category: string): any[] {
  // create catPath and catArray
  const catArray: string[] = [];
  let cat = category;

  while (cat !== '') {
    catArray.push(cat);
    cat = cat.split('/').slice(0, -1).join('/');
  }
  return catArray;
}
/**
 * check for foreign key field(s) change
 * @param change
 * @param fk
 */
function fkChange(change: functions.Change<functions.firestore.DocumentSnapshot>, fk: any) {
  // simplify input data
  const after: any = change.after.exists ? change.after.data() : null;
  const before: any = change.before.exists ? change.before.data() : null;

  if (Array.isArray(fk)) {
    for (const k of fk) {
      if (before[k] !== after[k]) {
        return true;
      }
    }
    return false;
  }
  return before[fk] !== after[fk];
}
/**
 * Aggregate data
 * @param change - change functions snapshot
 * @param context - event context
 * @param targetRef - document reference to edit
 * @param queryRef - query reference to aggregate on doc
 * @param fieldExceptions - the fields not to include
 * @param aggregateField - the name of the aggregated field
 * @param data - if adding any other data to the document
 * @param n - the number of documents to aggregate, default 3
 * @param alwaysAggregate - skip redundant aggregation, useful if not date sort
 */
async function aggregateData(
  change: functions.Change<functions.firestore.DocumentSnapshot>,
  context: functions.EventContext,
  targetRef: FirebaseFirestore.DocumentReference,
  queryRef: FirebaseFirestore.Query,
  fieldExceptions: string[],
  aggregateField: string = '',
  data: any = {},
  n: number = 3,
  alwaysAggregate = false,
) {
  // simplify event types
  const updateDoc = change.before.exists && change.after.exists;
  const deleteDoc = change.before.exists && !change.after.exists;
  const popDoc = updateDoc || deleteDoc;

  // collection name and doc id
  const cols = context.resource.name.split('/');
  const colId = cols[cols.length - 2];
  const docId = cols[cols.length - 1];

  if (!aggregateField) {
    aggregateField = colId + 'Aggregate';
  }
  data[aggregateField] = [];

  // doc references
  const targetSnap = await targetRef.get();
  const querySnap = await queryRef.limit(n).get();
  const targetData: any = targetSnap.data();
  const targetDocs: any[] = targetData[aggregateField];

  // check if aggregation is necessary
  if (popDoc && !alwaysAggregate) {
    let docExists = false;
    if (targetDocs) {
      targetDocs.forEach((doc: any) => {
        if (doc.id === docId) {
          docExists = true;
        }
      });
    }
    // don't update aggregation if doc not already in aggregation
    // or if doc is not being created
    if (!docExists) {
      return null;
    }
  }
  // get the latest data, save it
  querySnap.docs.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
    // document data
    const d = doc.data();
    const id = 'id';
    d[id] = doc.id;

    // don't save the field exceptions
    fieldExceptions.forEach((field: string) => {
      delete d[field];
    });
    data[aggregateField].push(d);
  });
  console.log('Aggregating ', colId, ' data on ', targetRef.path);
  await targetRef.set(data, { merge: true }).catch((e: any) => {
    console.log(e);
  });
  return null;
}
/**
 * trigger Function to update dates and filtered values
 * @param change
 * @param data
 * @param dates
 */
async function triggerFunction(
  change: functions.Change<functions.firestore.DocumentSnapshot>,
  data: any = {},
  dates = true,
) {
  // simplify event types
  const createDoc = change.after.exists && !change.before.exists;
  const updateDoc = change.before.exists && change.after.exists;
  const writeDoc = createDoc || updateDoc;

  if (dates) {
    if (createDoc) {
      // createdAt
      data.createdAt = admin.firestore.FieldValue.serverTimestamp();
    }
    if (updateDoc) {
      // updatedAt
      data.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    }
  }
  if (writeDoc) {
    if (Object.keys(data).length) {
      console.log('Running function again to update data:', JSON.stringify(data));
      await change.after.ref.set(data, { merge: true }).catch((e: any) => {
        console.log(e);
      });
    }
  }
  return null;
}
/**
 * loop through arrays in chunks
 */
class ArrayChunk {
  arr: any[];
  chunk: number;

  constructor(arr: any[], chunk = 100) {
    this.arr = arr;
    this.chunk = chunk;
  }

  forEachChunk(funct: (ch: any[]) => void) {
    for (let i = 0, j = this.arr.length; i < j; i += this.chunk) {
      const tempArray = this.arr.slice(i, i + this.chunk);
      funct(tempArray);
    }
  }
}
