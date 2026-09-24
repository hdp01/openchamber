import { describe, expect, test } from 'bun:test';

import type { AttachedFile } from '@/stores/types/sessionTypes';

import {
    filterMissingInlineAttachments,
    type DirectoryLister,
} from '../inlineMentionAttachments';

function inlineFile(id: string, serverPath: string, filename: string): AttachedFile {
    return {
        id: `inline-server-${id}`,
        file: new File([], filename, { type: 'text/plain' }),
        filename,
        mimeType: 'text/plain',
        size: 0,
        dataUrl: `file://${serverPath}`,
        source: 'server',
        serverPath,
    };
}

function pickedFile(id: string, serverPath: string, filename: string): AttachedFile {
    return { ...inlineFile(`picked-${id}`, serverPath, filename), id, source: 'server' };
}

function lister(
    listings: Record<string, string[]>,
    calls: string[],
    throws = false,
): DirectoryLister {
    return {
        listLocalDirectory: async (directory: string) => {
            calls.push(directory);
            if (throws) throw new Error('listing failed');
            return (listings[directory] ?? []).map((path) => ({ path }));
        },
    };
}

describe('filterMissingInlineAttachments', () => {
    test('keeps everything when no inline attachments exist', async () => {
        const calls: string[] = [];
        const files = [pickedFile('a', '/repo/exists.txt', 'exists.txt')];

        const result = await filterMissingInlineAttachments(files, lister({}, calls));

        expect(result.sendable).toEqual(files);
        expect(result.skippedNames).toEqual([]);
        expect(calls).toEqual([]);
    });

    test('keeps attachments whose files exist, listing each directory once', async () => {
        const calls: string[] = [];
        const files = [
            inlineFile('1', '/repo/a.txt', 'a.txt'),
            inlineFile('2', '/repo/b.txt', 'b.txt'),
        ];

        const result = await filterMissingInlineAttachments(
            files,
            lister({ '/repo': ['/repo/a.txt', '/repo/b.txt'] }, calls),
        );

        expect(result.sendable).toEqual(files);
        expect(result.skippedNames).toEqual([]);
        expect(calls).toEqual(['/repo']);
    });

    test('drops only the missing inline attachment and names it', async () => {
        const calls: string[] = [];
        const real = inlineFile('1', '/repo/real.txt', 'real.txt');
        const phantom = inlineFile('2', '/repo/masha.conner', 'masha.conner');
        const picked = pickedFile('p', '/repo/gone.txt', 'gone.txt');

        const result = await filterMissingInlineAttachments(
            [real, phantom, picked],
            lister({ '/repo': ['/repo/real.txt'] }, calls),
        );

        expect(result.sendable).toEqual([real, picked]);
        expect(result.skippedNames).toEqual(['masha.conner']);
    });

    test('fails open when the listing errors', async () => {
        const calls: string[] = [];
        const files = [inlineFile('1', '/repo/missing.txt', 'missing.txt')];

        const result = await filterMissingInlineAttachments(files, lister({}, calls, true));

        expect(result.sendable).toEqual(files);
        expect(result.skippedNames).toEqual([]);
    });
});
