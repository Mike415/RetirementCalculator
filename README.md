# Retirement Planner

A personal retirement projection web app built with React + Vite + Tailwind CSS.

Input your current account balances, income, mortgage details, and life-stage budgets to project net worth and account balances year-by-year through retirement.

## Features

- **Overview dashboard** — net worth projection chart, account breakdown, retirement snapshot
- **Accounts** — cash, investments, 401K, Roth 401K, Roth IRA, Traditional IRA balances + contributions
- **Income & Taxes** — gross income, growth rate, effective tax rate
- **Home & Mortgage** — home value, loan balance, mortgage terms, extra payments, housing costs
- **Assumptions** — investment growth rate, inflation rate
- **Budget Periods** — 6 life-stage budget editors (Nanny → School → Activity → High School → College → Post College)
- **Projections Table** — year-by-year table with Summary, Accounts, and Expenses views

All data is stored locally in your browser (localStorage) — nothing is sent to any server.

---

## Local Development

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Hosting on GitHub Pages

### Automatic deployment (recommended)

1. Push this repo to GitHub.
2. Go to **Settings → Pages** in your repo.
3. Under **Source**, select **GitHub Actions**.
4. The included workflow (`.github/workflows/deploy.yml`) will build and deploy automatically on every push to `main`.

**If your repo is a project page** (URL will be `https://username.github.io/repo-name/`), set the base path:

- Open `.github/workflows/deploy.yml`
- Add this environment variable to the **Build** step:
  ```yaml
  env:
    VITE_BASE_PATH: /repo-name/
  ```

**If your repo is a user/org page** (URL will be `https://username.github.io/`), no changes needed — the default base path of `/` is correct.

### Manual build

```bash
# Build for root domain (username.github.io)
pnpm build:pages

# Build for project page (username.github.io/repo-name/)
VITE_BASE_PATH=/repo-name/ pnpm build:pages
```

The output is in `dist/public/` — upload those files to any static host (Netlify, Cloudflare Pages, S3, etc.).

---

## Tech Stack

- [React 19](https://react.dev/)
- [Vite 7](https://vitejs.dev/)
- [Tailwind CSS 4](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/) (Radix UI primitives)
- [Recharts](https://recharts.org/) — charts
- [Wouter](https://github.com/molefrog/wouter) — client-side routing
- [Lucide React](https://lucide.dev/) — icons

