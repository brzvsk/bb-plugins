import { expect, it } from 'vitest';
import plugin from './server';
it('keeps recently visited old sessions ahead of freshly updated ones and excludes archived/hidden/deleted', async () => {
 let recent!: (input: { ids: string[] }) => Promise<any[]>;
 const thread = (id: string, updatedAt: number, extra = {}) => ({ id, updatedAt, projectId: 'p', title: id, visibility: 'visible', archivedAt: null, deletedAt: null, status: 'idle', ...extra });
 const threads = [thread('old', 0), ...Array.from({ length: 30 }, (_, i) => thread(`new${i}`, i + 1)), thread('archived', 99, { archivedAt: 1 }), thread('hidden', 99, { visibility: 'hidden' }), thread('deleted', 99, { deletedAt: 1 })];
 plugin({ settings: { define() {} }, rpc: { register(_contract: unknown, handlers: any) { recent = handlers.recent; } }, sdk: { threads: { list: async () => threads }, projects: { list: async () => [{ id: 'p', name: 'Project' }] } } } as any);
 const result = await recent({ ids: ['archived', 'hidden', 'deleted', 'old'] });
 expect(result).toHaveLength(7); expect(result[0]).toMatchObject({ id: 'old', project: 'Project' }); expect(result[1].id).toBe('new29');
 expect(result.map(t => t.id)).not.toEqual(expect.arrayContaining(['archived']));
});
