/** Serializa BigInt para JSON (respostas da API). */
export function jsonSafe(data) {
    return JSON.parse(JSON.stringify(data, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));
}
