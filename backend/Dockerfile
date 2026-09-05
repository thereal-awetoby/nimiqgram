FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3001<Link
  key={item.to}
  to={item.to}
  aria-label={item.label}
  style={{
    width: 46,
    height: 46,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    background: active ? '#f9e7b7' : 'transparent',
    color: active ? '#b6780a' : 'var(--text-muted)',
    transition: 'all 0.18s ease',
    boxShadow: active ? 'inset 0 0 0 1px rgba(182, 120, 10, 0.08)' : 'none',
  }}
>
  <NavIcon type={item.icon} active={active} />
</Link>

EXPOSE 3001

CMD ["npm", "run", "start"]
