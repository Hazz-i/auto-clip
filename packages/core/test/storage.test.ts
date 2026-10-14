import { describe, expect, it } from 'bun:test';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { LocalDriver, createStorageDriver, R2Driver } from '../src/storage.js';

describe('storage', () => {
  const testDir = './uploads-test';

  it('puts and gets file via LocalDriver', async () => {
    const driver = new LocalDriver(testDir);
    const key = 'test-file.txt';
    const content = 'hello cliper storage';

    await driver.put(key, content);
    const data = await driver.get(key);
    expect(data).not.toBeNull();
    const readText = new TextDecoder().decode(data!);
    expect(readText).toBe(content);

    const missing = await driver.get('non-existent.bin');
    expect(missing).toBeNull();

    // cleanup
    await rm(testDir, { recursive: true, force: true });
  });

  it('creates local driver by default', () => {
    delete process.env.STORAGE;
    const driver = createStorageDriver();
    expect(driver instanceof LocalDriver).toBe(true);
  });

  it('creates r2 driver when STORAGE=r2', () => {
    const driver = createStorageDriver('r2');
    expect(driver instanceof R2Driver).toBe(true);
  });
});
