# Domínio `luditeca.com` na Hostinger + HTTPS

O stack Docker continua a expor o Nginx interno em **`127.0.0.1:8080`** (porta `8080` do host). Para usar **`https://luditeca.com`** sem expor essa porta ao público, o habitual é instalar um **Nginx (ou Caddy) no próprio Ubuntu** nas portas **80** e **443**, que faz proxy para `http://127.0.0.1:8080`, e obter certificado com **Let’s Encrypt (Certbot)**.

## 1. DNS na Hostinger

1. No painel **Hostinger** → **Domínios** → **luditeca.com** → **DNS / Zona DNS**.
2. Aponta o domínio para o **IP público da VPS** (o mesmo do SSH, ex.: `187.127.0.245`):

| Tipo | Nome / Host | Valor / Aponta para | TTL |
|------|-------------|---------------------|-----|
| **A** | `@` | IP da VPS | 3600 ou automático |
| **A** | `www` | IP da VPS | idem |

3. Remove ou ajusta registos **A** antigos que apontem para outro sítio (evita conflitos).
4. Espera a propagação (em geral **15 minutos a algumas horas**). Teste no PC:

```bash
nslookup luditeca.com
nslookup www.luditeca.com
```

Ambos devem resolver para o IP da VPS.

## 2. Firewall

- No **hPanel da VPS** (Hostinger): abre **TCP 80** e **TCP 443** (e mantém **22** para SSH).
- Se usares **UFW** no Ubuntu:

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload
sudo ufw status
```

Opcional: deixa de expor **8080** ao mundo se só vais usar 80/443 (o Docker pode continuar a mapear 8080 só em localhost — ver nota no fim).

## 3. Nginx no sistema (proxy para o Docker)

Instala o Nginx no **host** (não dentro do container):

```bash
sudo apt update
sudo apt install -y nginx
```

Cria o site (ajusta `server_name` se usares só `luditeca.com`):

```bash
sudo nano /etc/nginx/sites-available/luditeca.com
```

Conteúdo mínimo (HTTP primeiro; o Certbot altera depois):

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name luditeca.com www.luditeca.com;

    client_max_body_size 600m;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
    }
}
```

Ativa o site e testa:

```bash
sudo ln -sf /etc/nginx/sites-available/luditeca.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Garante que o stack Docker está de pé: `curl -sI http://127.0.0.1:8080` → deve responder.

Teste por HTTP: `curl -sI http://luditeca.com` → **200** ou **301** (antes do SSL).

## 4. Certificado SSL (Let’s Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d luditeca.com -d www.luditeca.com
```

Segue o assistente (email para avisos). O Certbot ajusta o Nginx para **HTTPS** e renovação automática.

Renovação de teste:

```bash
sudo certbot renew --dry-run
```

## 5. Variáveis do projeto Luditeca (`.env` na VPS)

Na pasta `/opt/luditeca-vps`, edita o `.env` (na raiz, junto ao `docker-compose.yml`):

```env
PUBLIC_MEDIA_BASE=https://luditeca.com/media
CORS_ORIGIN=https://luditeca.com

NEXT_PUBLIC_API_URL=https://luditeca.com/api
NEXT_PUBLIC_MEDIA_BASE_URL=https://luditeca.com/media
```

- **Sem barra final** em `CORS_ORIGIN`.
- Se usares **só** `www` ou só **apex**, alinha todos os URLs ao mesmo host que o browser usa.

### Rebuild do front (obrigatório)

O Next embute `NEXT_PUBLIC_*` no build:

```bash
cd /opt/luditeca-vps
docker compose build --no-cache web
docker compose up -d
```

Reinicia a API se só mudaste variáveis de ambiente da API:

```bash
docker compose up -d api
```

## 6. Redirecionar `www` → `luditeca.com` (opcional)

Podes configurar no Nginx do host ou no painel Hostinger; o Certbot já cobre ambos os nomes se tiveres pedido `-d luditeca.com -d www.luditeca.com`.

## 7. Erro **502 Bad Gateway** (`nginx/1.24.0 Ubuntu`)

O Nginx **do servidor** está a responder, mas **não há nada em `127.0.0.1:8080`** (stack Docker parada) → `Connection refused` no `/var/log/nginx/error.log`.

```bash
cd /opt/luditeca-vps
docker compose ps
curl -sI http://127.0.0.1:8080/
docker compose up -d
```

O `docker-compose.yml` do repositório usa `restart: unless-stopped` nos serviços para voltarem a subir após **reboot** da VPS (faz `git pull` e `docker compose up -d` uma vez para aplicar).

## 8. Checklist final

- [ ] `https://luditeca.com` abre o CMS (cadeado válido no browser).
- [ ] `https://luditeca.com/api/health` devolve `{"ok":true,...}`.
- [ ] Login no CMS funciona (CORS e URLs públicas coerentes com o domínio).

---

### Nota: porta 8080

- Com o Nginx no host em **80/443**, o utilizador acede por **`https://luditeca.com`**; não precisa de `:8080`.
- Podes restringir o `docker-compose` para mapear só localmente, por exemplo `127.0.0.1:8080:80` no serviço `nginx` (alteração no `docker-compose.yml`); se quiseres isso no repositório, pede num PR separado.

---

### Email e outros registos DNS

Para o domínio enviar emails (SMTP), são **outros** registos (MX, TXT). Não interferem com o site em `A`/`www` se configurados corretamente.
