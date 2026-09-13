import { describe, expect, it } from 'vitest'

describe('loadConfig', () => {
    it('uses safe defaults', () => {
       expect(loadConfig()).toMatchObject({
            host: '0.0.0.0',
            port: 3000,
            providerTimeoutMs: 5000,
            cacheTtlSeconds: 900,
            cacheMaxItems: 500,
        })
    })

    it('rejects invalid numeric values', () => {
        expect(() => loadConfig({ PORT: 'abc' })).toThrow('Invalid environment')
    })
})