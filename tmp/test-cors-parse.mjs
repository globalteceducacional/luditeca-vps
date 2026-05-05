// Teste isolado da função parseCorsOrigin extraída inline.
// Não importa server.ts (não queremos abrir porta), só replica a lógica
// para sabermos que os 4 cenários de validação se comportam.

function parseCorsOrigin() {
  const raw = process.env.CORS_ORIGIN?.trim();
  const isProd = process.env.NODE_ENV === 'production';
  if (!raw) {
    if (isProd) {
      throw new Error(
        'CORS_ORIGIN obrigatório em produção. Defina lista de origens separadas ' +
          'por vírgula, sem barra final. ' +
          'Ex.: CORS_ORIGIN="https://luditeca.com,https://www.luditeca.com"',
      );
    }
    return ['http://localhost:3000', 'http://localhost:8080'];
  }
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean);
  if (list.length === 0) {
    throw new Error('CORS_ORIGIN definida mas vazia após parsing (apenas vírgulas?).');
  }
  for (const origin of list) {
    if (!/^https?:\/\/[^/]+$/.test(origin)) {
      throw new Error(
        `CORS_ORIGIN entrada inválida: "${origin}". ` +
          'Deve ser http(s)://host[:port] sem barra final ou caminho.',
      );
    }
  }
  return list;
}

const cases = [
  { name: 'dev sem env',         env: 'development', val: undefined,                         expectThrow: false },
  { name: 'prod sem env',        env: 'production',  val: undefined,                         expectThrow: true  },
  { name: 'prod env vazio',      env: 'production',  val: '',                                expectThrow: true  },
  { name: 'prod env so virgulas',env: 'production',  val: ', , ,',                           expectThrow: true  },
  { name: 'prod barra final',    env: 'production',  val: 'https://luditeca.com/',           expectThrow: true  },
  { name: 'prod com path',       env: 'production',  val: 'https://luditeca.com/api',        expectThrow: true  },
  { name: 'prod sem proto',      env: 'production',  val: 'luditeca.com',                    expectThrow: true  },
  { name: 'prod ok',             env: 'production',  val: 'https://luditeca.com',            expectThrow: false },
  { name: 'prod ok 2 origens',   env: 'production',  val: 'https://a.com, https://b.com',    expectThrow: false },
];

let pass = 0, fail = 0;
for (const c of cases) {
  process.env.NODE_ENV = c.env;
  if (c.val === undefined) delete process.env.CORS_ORIGIN;
  else process.env.CORS_ORIGIN = c.val;
  try {
    const r = parseCorsOrigin();
    if (c.expectThrow) {
      console.log(`FAIL ${c.name} (esperava throw, devolveu ${JSON.stringify(r)})`);
      fail++;
    } else {
      console.log(`PASS ${c.name} -> ${JSON.stringify(r)}`);
      pass++;
    }
  } catch (e) {
    if (c.expectThrow) {
      console.log(`PASS ${c.name} -> throws "${e.message.slice(0, 60)}..."`);
      pass++;
    } else {
      console.log(`FAIL ${c.name} (throw inesperado: ${e.message})`);
      fail++;
    }
  }
}
console.log(`\n${pass}/${pass + fail} testes passaram.`);
process.exit(fail === 0 ? 0 : 1);
