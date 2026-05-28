# Fail2ban preparation for evakuatordn.ru

Fail2ban is not installed on the VPS at the time of preparation. Do not enable a jail before observing Nginx 429 volume for at least 1-2 days.

Install and prepare:

```bash
apt update
apt install -y fail2ban
cp /root/evakuatordn-fail2ban/evakuatordn-nginx-ratelimit.conf /etc/fail2ban/filter.d/
cp /root/evakuatordn-fail2ban/evakuatordn-nginx-ratelimit.local.example /etc/fail2ban/jail.d/evakuatordn-nginx-ratelimit.local
```

Before enabling, edit:

```bash
nano /etc/fail2ban/jail.d/evakuatordn-nginx-ratelimit.local
```

Change `enabled = false` to `enabled = true` only after checking that real users are not generating many 429 responses.

Test and start:

```bash
fail2ban-regex /var/log/nginx/evakuatordn-site.access.log /etc/fail2ban/filter.d/evakuatordn-nginx-ratelimit.conf
systemctl enable --now fail2ban
fail2ban-client status evakuatordn-nginx-ratelimit
```
