/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../nls.js';
import type { URI } from './state/sessionState.js';

/**
 * Helpers for building / parsing the URI clients subscribe to in order to
 * receive a {@link import('./state/protocol/state.js').ChangesetState}.
 *
 * The URI shape is:
 *
 *     <sessionUri>/changeset/<changesetId>
 *
 * Keeping changeset URIs nested under the session URI namespace lets the
 * server cleanly tear down every changeset for a session when that session
 * is disposed (the reverse-lookup is just a string-prefix scan).
 *
 * The id portion is the unmodified `ChangesetSummary.id` value the catalogue
 * advertised — this module performs no escaping.
 *
 * v1 of the changeset model only emits static (variable-free) URIs and the
 * helpers below enforce that: ids must be non-empty and must not contain
 * `/`, and parsing rejects any extra path segments after the id. The spec
 * sketches richer per-turn / between-turn templates (e.g.
 * `/changeset/turn/<turnId>`) — supporting those will need either escaping
 * at the call site or a more permissive parser, both of which are
 * deliberately out of scope here.
 */

/**
 * Stable id of the catalogue entry for the session-wide changeset (the v1
 * producer's only entry). Shared across server-side producers and
 * client-side consumers so the literal `'session'` string isn't repeated.
 */
export const SESSION_CHANGESET_ID = 'session';

/**
 * Localized human-readable label for the session-wide changeset entry.
 * Centralised here so producers (`agentService`, `agentSideEffects`) and
 * any future consumer that needs the same label stay in sync.
 */
export const sessionChangesetLabel = (): string => localize('sessionChangeset.label', "Session Changes");

/**
 * Marker injected into a changeset URI's path to distinguish it from any
 * other resource scoped to the same session.
 */
const CHANGESET_PATH_SEGMENT = '/changeset/';

/**
 * Returns the subscribable URI for `changesetId` on the session at
 * `sessionUri`.
 */
export function buildChangesetUri(sessionUri: URI, changesetId: string): URI {
	if (!changesetId) {
		throw new Error('buildChangesetUri: changesetId must be non-empty');
	}
	if (changesetId.includes('/')) {
		// '/' would be parsed as an additional path segment, which v1
		// callers never need. If that changes, prefer escaping at the call
		// site so the parser-side semantics stay unambiguous.
		throw new Error(`buildChangesetUri: changesetId must not contain '/' (got ${JSON.stringify(changesetId)})`);
	}
	return `${sessionUri}${CHANGESET_PATH_SEGMENT}${changesetId}`;
}

/**
 * Parses a changeset URI back into its `(sessionUri, changesetId)` parts,
 * or returns `undefined` if `uri` is not a changeset URI.
 *
 * Accepts both the live, unescaped form produced by {@link buildChangesetUri}
 * and any future encoded forms whose path still contains the
 * `/changeset/<id>` suffix.
 */
export function parseChangesetUri(uri: URI): { sessionUri: URI; changesetId: string } | undefined {
	const idx = uri.lastIndexOf(CHANGESET_PATH_SEGMENT);
	if (idx < 0) {
		return undefined;
	}
	const changesetId = uri.slice(idx + CHANGESET_PATH_SEGMENT.length);
	if (!changesetId || changesetId.includes('/')) {
		// Reject paths with extra segments after the id — v1 producers do
		// not emit them and treating them as a valid id would mask future
		// producer bugs.
		return undefined;
	}
	return { sessionUri: uri.slice(0, idx), changesetId };
}

/**
 * Returns `true` iff `uri` looks like a changeset URI — convenience wrapper
 * around {@link parseChangesetUri} for callers that only care about the
 * routing decision.
 */
export function isChangesetUri(uri: URI): boolean {
	return parseChangesetUri(uri) !== undefined;
}
