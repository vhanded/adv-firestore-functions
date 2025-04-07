import { Timestamp, FieldValue, DocumentData, DocumentSnapshot } from 'firebase-admin/firestore';
import { DocumentRecord } from './types';
import { Change } from 'firebase-functions/core';
import { EventContext } from 'firebase-functions/lib/v1/cloud-functions';
import { initializeApp } from 'firebase-admin/app';

type GetTriggerData = {
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

type SetTriggerData = {
  createdAt?: FieldValue;
  updatedAt?: FieldValue;
};

try {
  initializeApp();
} catch (e) {
  /* empty */
}
/**
 * The check functions for type of change
 * @param change
 */
export function updateDoc(change: Change<DocumentSnapshot>) {
  return change.before.exists && change.after.exists;
}
export function createDoc(change: Change<DocumentSnapshot>) {
  return change.after.exists && !change.before.exists;
}
export function deleteDoc(change: Change<DocumentSnapshot>) {
  return change.before.exists && !change.after.exists;
}
export function writeDoc(change: Change<DocumentSnapshot>) {
  // createDoc || updateDoc
  return change.after.exists;
}
export function shiftDoc(change: Change<DocumentSnapshot>) {
  // createDoc || deleteDoc
  return !change.after.exists || !change.before.exists;
}
export function popDoc(change: Change<DocumentSnapshot>) {
  // updateDoc || deleteDoc;
  return change.before.exists;
}
/**
 * Return a friendly url for the db
 * @param url
 */
export function getFriendlyURL(url: string): string {
  // delimeter to replace '/'
  const delim = '___';

  // get rid of '/' since can't store as id
  url = url.replace(/\//g, delim);

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
export function canContinue(after: GetTriggerData, before: GetTriggerData): boolean {
  // if update trigger
  if (before.updatedAt && after.updatedAt) {
    if (after.updatedAt.seconds !== before.updatedAt.seconds) {
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
 * @param change - change ref
 * @param context - event context
 */
export function isTriggerFunction(change: Change<DocumentSnapshot>, context: EventContext) {
  // simplify input data
  const after = change.after.exists ? change.after.data() : null;
  const before = change.before.exists ? change.before.data() : null;

  const eventId = context.eventId;

  if (updateDoc(change) && after && before && !canContinue(after, before)) {
    console.log('Trigger function run: ', eventId);
    return true;
  }
  return false;
}

/**
 * trigger Function to update dates and filtered values
 * @param change - change event
 * @param data - data to update
 * @param updateDates - use createdAt and updatedAt
 */
export async function triggerFunction(
  change: Change<DocumentSnapshot>,
  data: SetTriggerData = {},
  updateDates = true,
) {
  if (updateDates) {
    if (createDoc(change)) {
      // createdAt
      data.createdAt = FieldValue.serverTimestamp();
    }
    if (updateDoc(change)) {
      // updatedAt
      data.updatedAt = FieldValue.serverTimestamp();
    }
  }
  if (writeDoc(change)) {
    // if there is data to update, update
    if (Object.keys(data).length) {
      console.log('Running function again to update data:', JSON.stringify(data));
      await change.after.ref.set(data, { merge: true }).catch((e: Error) => {
        console.log(e);
      });
    }
  }
  return;
}
/**
 * Gets the unique values from the combined array
 * @param a1
 * @param a2
 * @return - unique values array
 */
export function findSingleValues<T>(a1: T[], a2: T[]): T[] {
  return a1.concat(a2).filter((v: T) => {
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
export function jsonEqual(a1: unknown, a2: unknown): boolean {
  return JSON.stringify(a1) === JSON.stringify(a2);
}
/**
 * Get the after value or null
 * @param change
 * @param val
 */
export function getAfter<T extends DocumentRecord<string, unknown>>(
  change: Change<DocumentSnapshot<T>>,
  val: keyof T,
) {
  // simplify input data
  const after = change.after.data();
  if (val === 'id') {
    return after ? (change.after.id as T[keyof T]) : ('' as T[keyof T]);
  }
  return after?.[val] as T[keyof T];
}
/**
 * Get the before value or null
 * @param change
 * @param val
 */
export function getBefore<T extends DocumentRecord<string, unknown>>(
  change: Change<DocumentSnapshot<T>>,
  val: keyof T,
) {
  // simplify input data
  const before = change.before.data();
  if (val === 'id') {
    return before ? (change.before.id as T[keyof T]) : ('' as T[keyof T]);
  }
  return before?.[val] as T[keyof T];
}
/**
 * Returns the latest value of a field
 * @param change
 * @param val
 */
export function getValue<T extends DocumentRecord<string, unknown>>(
  change: Change<DocumentSnapshot<T>>,
  val: keyof T,
) {
  // simplify input data
  const after = change.after.exists ? change.after.data() : null;
  const before = change.before.exists ? change.before.data() : null;

  if (val === 'id') {
    return after ? (change.after.id as T[keyof T]) : (change.before.id as T[keyof T]);
  }
  return after ? after[val] : (before?.[val] as T[keyof T]);
}
/**
 * Determine if there is a before value
 * @param change
 * @param val
 * @returns
 */
export function valueBefore<T extends DocumentData>(
  change: Change<DocumentSnapshot<T>>,
  val: keyof T,
): boolean {
  const before = change.before.exists ? change.before.data() : null;
  if (before) {
    if (val === 'id' || val in before) {
      return true;
    }
  }
  return false;
}
/**
 * Determine if there is an after value
 * @param change
 * @param val
 * @returns
 */
export function valueAfter<T extends DocumentData>(
  change: Change<DocumentSnapshot<T>>,
  val: keyof T,
): boolean {
  const after = change.after.exists ? change.after.data() : null;
  if (after) {
    if (val === 'id' || val in after) {
      return true;
    }
  }
  return false;
}
/**
 * Determine if a field has been created
 * @param change
 * @param val - field
 * @returns
 */
export function valueCreate<T extends DocumentData>(
  change: Change<DocumentSnapshot<T>>,
  val: keyof T,
): boolean {
  if (!valueBefore(change, val) && valueAfter(change, val)) {
    return true;
  }
  return false;
}
/**
 * Determine if a field has been deleted
 * @param change
 * @param val - field
 * @returns
 */
export function valueDelete<T extends DocumentData>(
  change: Change<DocumentSnapshot<T>>,
  val: keyof T,
): boolean {
  if (valueBefore(change, val) && !valueAfter(change, val)) {
    return true;
  }
  return false;
}
/**
 * Determine if a field value has been updated
 * @param change
 * @param val
 */
export function valueChange<T extends DocumentData>(
  change: Change<DocumentSnapshot<T>>,
  val: keyof T,
): boolean {
  if (valueDelete(change, val) || valueCreate(change, val)) {
    return true;
  }
  if (jsonEqual(getBefore(change, val), getAfter(change, val))) {
    return false;
  }
  return true;
}
/**
 * Returns the collection name
 * @param context
 */
export function getCollection(context: EventContext) {
  return context.resource.name.split('/')[5];
}
/**
 * Checks for any updated value in array
 * @param change - change event
 * @param arr - array of values to check
 */
export function arrayValueChange<T extends DocumentData>(
  change: Change<DocumentSnapshot<T>>,
  arr: (keyof T)[],
): boolean {
  // check each array
  for (const v of arr) {
    if (valueChange(change, v)) {
      return true;
    }
  }
  return false;
}
/**
 * Returns the category array
 * @param category
 */
export function getCatArray(category: string): string[] {
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
export function foreignKeyChange(change: Change<DocumentSnapshot>, fk: string | string[]) {
  // simplify input data
  const after = change.after.data();
  const before = change.before.data();

  if (Array.isArray(fk)) {
    for (const k of fk) {
      if (before?.[k] !== after?.[k]) {
        return true;
      }
    }
    return false;
  }
  return before?.[fk] !== after?.[fk];
}

export function soundex(s: string) {
  const a = s.toLowerCase().split('');
  const f = a.shift() as string;
  let r = '';
  const codes = {
    a: '',
    e: '',
    i: '',
    o: '',
    u: '',
    b: 1,
    f: 1,
    p: 1,
    v: 1,
    c: 2,
    g: 2,
    j: 2,
    k: 2,
    q: 2,
    s: 2,
    x: 2,
    z: 2,
    d: 3,
    t: 3,
    l: 4,
    m: 5,
    n: 5,
    r: 6,
  } as { [field: string]: string | number };
  r =
    f +
    a
      .map((v) => {
        return `${codes[v]}`;
      })
      .filter((v, i, b) => {
        return i === 0 ? v !== `${codes[f]}` : v !== b[i - 1];
      })
      .join('');
  return (r + '000').slice(0, 4).toUpperCase();
}

export function generateTrigrams(s: string) {
  const trigrams: string[] = [];
  function* ngrams(a: string, n: number) {
    const buf: string[] = [];
    for (const x of a) {
      buf.push(x);
      if (buf.length === n) {
        yield buf;
        buf.shift();
      }
    }
  }
  for (const g of ngrams(s, 3)) {
    trigrams.push(g.join(''));
  }
  // unique only
  return trigrams.filter((v, i, a) => a.indexOf(v) === i);
}
