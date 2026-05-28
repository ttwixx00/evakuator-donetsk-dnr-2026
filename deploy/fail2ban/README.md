# Fail2ban preparation for evakuatordn.ru

Fail2ban is enabled on the VPS with a soft jail for repeated Nginx 429 / rate-limit events.

Install and prepare:

```bash
apt update
apt install -y fail2ban
cp /root/evakuatordn-fail2ban/evakuatordn-nginx-ratelimit.conf /etc/fail2ban/filter.d/
cp /root/evakuatordn-fail2ban/evakuatordn-nginx-ratelimit.local.example /etc/fail2ban/jail.d/evakuatordn-nginx-ratelimit.local
```

The jail is intentionally soft:

- `maxretry = 30`
- `findtime = 10m`
- `bantime = 30m`
- only `http,https` are banned
- server self-check IP is ignored

Edit if needed:

```bash
nano /etc/fail2ban/jail.d/evakuatordn-nginx-ratelimit.local
```

Test and start:

```bash
fail2ban-regex /var/log/nginx/evakuatordn-site.access.log /etc/fail2ban/filter.d/evakuatordn-nginx-ratelimit.conf
systemctl enable --now fail2ban
fail2ban-client status evdn-nginx-limit
```

Unban an IP:

```bash
fail2ban-client set evdn-nginx-limit unbanip 1.2.3.4
```
