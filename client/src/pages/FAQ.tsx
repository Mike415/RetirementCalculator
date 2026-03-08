/**
 * FAQ — Frequently Asked Questions for Project Retire
 * Covers retirement planning concepts, app usage, and data/privacy questions.
 */

import { useState } from "react";
import { ChevronDown, HelpCircle, BookOpen, Shield, BarChart3, Cloud } from "lucide-react";
import { cn } from "@/lib/utils";

interface FAQItem {
  question: string;
  answer: React.ReactNode;
}

interface FAQSection {
  title: string;
  icon: React.ElementType;
  items: FAQItem[];
}

const FAQ_SECTIONS: FAQSection[] = [
  {
    title: "Getting Started",
    icon: BookOpen,
    items: [
      {
        question: "What is Project Retire?",
        answer: (
          <p>
            Project Retire is a detailed, tax-aware retirement planning tool that projects your net
            worth from today through your chosen end age. You enter your current account balances,
            income, spending, and assumptions — and the tool builds a year-by-year model showing
            whether your money lasts. It handles 401(k)s, IRAs, Roth accounts, taxable brokerage
            accounts, Social Security, mortgages, and one-time events like home sales or
            inheritances.
          </p>
        ),
      },
      {
        question: "How do I get started?",
        answer: (
          <ol className="list-decimal list-inside space-y-1.5">
            <li>
              Go to <strong>Accounts &amp; Timeline</strong> and enter your current account balances
              and retirement age.
            </li>
            <li>
              Visit <strong>Income &amp; Taxes</strong> to enter your current salary and expected
              retirement income.
            </li>
            <li>
              Set your spending in <strong>Budget Periods</strong> — you can define different
              spending phases (working years, early retirement, late retirement).
            </li>
            <li>
              Check <strong>Assumptions</strong> to review growth rates, inflation, and tax
              settings.
            </li>
            <li>
              View your results on the <strong>Overview</strong> and{" "}
              <strong>Projections Table</strong> pages.
            </li>
          </ol>
        ),
      },
      {
        question: "Is Project Retire free to use?",
        answer: (
          <p>
            Yes — during the current beta phase, all features are unlocked for free. This includes
            cloud sync, multiple saved plans, Monte Carlo simulations, and the Roth conversion
            optimizer. Pricing will be introduced after the beta period ends, and early users will
            receive advance notice.
          </p>
        ),
      },
      {
        question: "Do I need to create an account?",
        answer: (
          <p>
            No. You can use Project Retire entirely without signing in — your plan is saved locally
            in your browser. However, signing in with your Google or email account enables{" "}
            <strong>cloud sync</strong>, which backs up your plan to our servers and lets you access
            it from any device or browser.
          </p>
        ),
      },
    ],
  },
  {
    title: "Retirement Planning Concepts",
    icon: BarChart3,
    items: [
      {
        question: "What is the 4% rule and does Project Retire use it?",
        answer: (
          <p>
            The 4% rule is a popular guideline suggesting you can safely withdraw 4% of your
            portfolio per year in retirement without running out of money over a 30-year period. It
            comes from the Trinity Study (1998). Project Retire does <em>not</em> hard-code the 4%
            rule — instead, it models your actual spending, taxes, and account withdrawals year by
            year, giving you a more personalized picture. You can see your effective withdrawal rate
            on the Overview page.
          </p>
        ),
      },
      {
        question: "What is a Roth conversion and why does it matter?",
        answer: (
          <p>
            A Roth conversion moves money from a traditional pre-tax account (like a 401(k) or
            Traditional IRA) into a Roth IRA. You pay income tax on the converted amount now, but
            future growth and withdrawals are tax-free. Conversions are most valuable in years when
            your income is lower — typically between retirement and when Social Security or RMDs
            begin. Project Retire's <strong>Roth conversion optimizer</strong> finds the annual
            conversion schedule that maximizes your final net worth.
          </p>
        ),
      },
      {
        question: "What are Required Minimum Distributions (RMDs)?",
        answer: (
          <p>
            The IRS requires you to start withdrawing a minimum amount from traditional pre-tax
            retirement accounts (401(k), Traditional IRA) starting at age 73 (as of 2023, under
            SECURE 2.0). The amount is calculated by dividing your account balance by an IRS life
            expectancy factor. Project Retire automatically calculates and includes RMDs in your
            projections, showing the tax impact each year.
          </p>
        ),
      },
      {
        question: "How does Social Security work in the projections?",
        answer: (
          <p>
            You can enable Social Security on the <strong>Social Security</strong> page and enter
            your estimated monthly benefit and the age you plan to claim. Claiming earlier (age 62)
            reduces your benefit; delaying to age 70 increases it by roughly 8% per year. Project
            Retire models the benefit as inflation-adjusted income starting at your chosen claim
            age, and factors it into your annual cash flow.
          </p>
        ),
      },
      {
        question: "What is Monte Carlo simulation and how should I interpret it?",
        answer: (
          <p>
            Monte Carlo simulation runs your plan through hundreds of randomized market scenarios —
            varying annual returns around your assumed average — to estimate the probability that
            your money lasts through retirement. A result of "87% success" means your portfolio
            survived in 87 out of 100 simulated scenarios. Most financial planners target 85–95%.
            Lower success rates suggest you may need to save more, spend less, or retire later.
          </p>
        ),
      },
      {
        question: "What is the difference between pre-tax, Roth, and taxable accounts?",
        answer: (
          <div className="space-y-2">
            <p>
              <strong>Pre-tax (Traditional 401k / IRA):</strong> Contributions reduce your taxable
              income today. Withdrawals in retirement are taxed as ordinary income. Subject to RMDs
              at age 73.
            </p>
            <p>
              <strong>Roth (Roth 401k / Roth IRA):</strong> Contributions are made with after-tax
              dollars. Growth and qualified withdrawals are completely tax-free. No RMDs during your
              lifetime.
            </p>
            <p>
              <strong>Taxable brokerage:</strong> No special tax treatment. You pay capital gains
              tax when you sell investments. Long-term gains (held over 1 year) are taxed at lower
              rates (0%, 15%, or 20% depending on income).
            </p>
          </div>
        ),
      },
      {
        question: "How does inflation affect my projections?",
        answer: (
          <p>
            Project Retire applies your chosen inflation rate (default: 3%) to your spending each
            year. This means a $5,000/month budget today will be modeled as $5,150/month next year,
            $5,305 the year after, and so on. Income sources like Social Security are also
            inflation-adjusted. You can change the inflation assumption on the{" "}
            <strong>Assumptions</strong> page.
          </p>
        ),
      },
    ],
  },
  {
    title: "Using the App",
    icon: HelpCircle,
    items: [
      {
        question: "How do I save my plan?",
        answer: (
          <p>
            If you're signed in, your plan is automatically saved to the cloud 3 seconds after any
            change. You can also manually save using the <strong>Save</strong> button in the Cloud
            Sync section of the sidebar dropdown. If you're not signed in, your plan is saved
            automatically to your browser's local storage — it will persist across page refreshes
            but not across devices or browsers.
          </p>
        ),
      },
      {
        question: "How do I load a previously saved plan?",
        answer: (
          <p>
            When you sign in, Project Retire automatically detects your most recent cloud-saved plan
            and offers to load it via a notification at the bottom of the screen. You can also
            manually load your cloud plan at any time using the <strong>Load</strong> button in the
            Cloud Sync section of the sidebar. To manage multiple saved plans, visit the{" "}
            <strong>My Plans</strong> page under the Account section.
          </p>
        ),
      },
      {
        question: "Can I have multiple retirement plans?",
        answer: (
          <p>
            Yes. During the beta phase, all users can save up to 10 plans. You can create, rename,
            and switch between plans on the <strong>My Plans</strong> page. This is useful for
            comparing different scenarios — for example, "retire at 60" vs. "retire at 65", or
            "aggressive growth" vs. "conservative growth".
          </p>
        ),
      },
      {
        question: "How do I import or export my plan?",
        answer: (
          <p>
            Use the <strong>Export</strong> button in the sidebar dropdown to download your plan as
            a <code>.json</code> file. You can share this file, back it up, or import it into
            another browser using the <strong>Import</strong> button. This is also useful for
            migrating your data if you switch accounts.
          </p>
        ),
      },
      {
        question: "What does 'Reset to Defaults' do?",
        answer: (
          <p>
            Reset to Defaults replaces all your inputs with the built-in sample plan — a California
            couple in their mid-30s with typical income, accounts, and spending. This is useful for
            exploring the app's features before entering your own data. Note: this action cannot be
            undone unless you have a cloud save to restore from.
          </p>
        ),
      },
      {
        question: "What are One-Time Events?",
        answer: (
          <p>
            One-Time Events let you model large, non-recurring cash flows at specific ages — for
            example, a home sale, inheritance, college tuition payment, or a large purchase. Each
            event has a year, an amount (positive for income, negative for expense), and an account
            to deposit into or withdraw from. These are added on the{" "}
            <strong>One-Time Events</strong> page.
          </p>
        ),
      },
    ],
  },
  {
    title: "Data & Privacy",
    icon: Shield,
    items: [
      {
        question: "Is my financial data secure?",
        answer: (
          <p>
            Your plan data is stored in our database (TiDB Cloud, hosted on AWS US-West), which
            provides encryption at rest and in transit. We use Clerk for authentication, which means
            we never store your password — authentication is handled by industry-standard OAuth and
            JWT tokens. Your financial data is associated with your account and is never shared with
            third parties or used for advertising. As with any cloud service, the Project Retire team
            has administrative database access for support and operational purposes — your data is
            not end-to-end encrypted.
          </p>
        ),
      },
      {
        question: "Does Project Retire share my data with anyone?",
        answer: (
          <p>
            No. Your retirement plan data is private to your account. We do not sell data, share it
            with advertisers, or use it to train AI models. The only third-party services we use are
            Clerk (authentication) and Stripe (billing) — neither receives your financial plan data.
          </p>
        ),
      },
      {
        question: "What happens to my data if I delete my account?",
        answer: (
          <p>
            If you delete your account, all associated plan data is permanently removed from our
            servers. We recommend exporting your plan as a JSON file before deleting your account if
            you want to keep a local copy.
          </p>
        ),
      },
      {
        question: "Is this financial advice?",
        answer: (
          <p>
            No. Project Retire is an educational and planning tool. The projections it generates are
            estimates based on the assumptions you enter and do not account for all real-world
            variables (taxes, fees, market conditions, life events, etc.). Always consult a licensed
            financial advisor before making retirement or investment decisions.
          </p>
        ),
      },
    ],
  },
  {
    title: "Cloud Sync",
    icon: Cloud,
    items: [
      {
        question: "How does cloud sync work?",
        answer: (
          <p>
            When you're signed in, Project Retire automatically saves your plan to the cloud 3
            seconds after any change. The sync status is shown in the sidebar — you'll see "Saving…"
            while it's uploading and "Saved" with a timestamp when complete. Your plan is stored
            securely in our database and can be loaded on any device where you sign in.
          </p>
        ),
      },
      {
        question: "What happens when I sign in on a new device?",
        answer: (
          <p>
            When you sign in, Project Retire checks for a saved cloud plan and offers to load it via
            a notification. If you choose to load it, your cloud plan replaces the local data in
            your browser. If you dismiss the notification, your local data is kept and auto-save
            will start syncing it to the cloud going forward.
          </p>
        ),
      },
      {
        question: "Can I use the app offline?",
        answer: (
          <p>
            Yes. All calculations run entirely in your browser — no internet connection is needed to
            use the planning tool. Your plan is saved to browser local storage as a fallback. Cloud
            sync requires an internet connection and will resume automatically when you're back
            online.
          </p>
        ),
      },
    ],
  },
];

function FAQAccordionItem({ item }: { item: FAQItem }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-stone-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-start justify-between gap-4 px-5 py-4 text-left hover:bg-stone-50 transition-colors"
      >
        <span className="font-medium text-stone-800 text-sm leading-snug">{item.question}</span>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-stone-400 flex-shrink-0 mt-0.5 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>
      <div
        className={cn(
          "overflow-hidden transition-all duration-200 ease-in-out",
          open ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="px-5 pb-5 pt-1 text-sm text-stone-600 leading-relaxed border-t border-stone-100">
          {item.answer}
        </div>
      </div>
    </div>
  );
}

export default function FAQ() {
  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-xl bg-[#D97706]/10 flex items-center justify-center">
            <HelpCircle className="w-5 h-5 text-[#D97706]" />
          </div>
          <h1 className="text-2xl font-bold text-stone-800" style={{ fontFamily: "'Playfair Display', serif" }}>
            Frequently Asked Questions
          </h1>
        </div>
        <p className="text-stone-500 text-sm ml-12">
          Everything you need to know about Project Retire and retirement planning.
        </p>
      </div>

      {/* Sections */}
      <div className="space-y-8">
        {FAQ_SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <div key={section.title}>
              <div className="flex items-center gap-2 mb-3">
                <Icon className="w-4 h-4 text-[#1B4332]" />
                <h2 className="text-xs font-bold uppercase tracking-widest text-[#1B4332]/70">
                  {section.title}
                </h2>
              </div>
              <div className="space-y-2">
                {section.items.map((item) => (
                  <FAQAccordionItem key={item.question} item={item} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer CTA */}
      <div className="mt-10 p-5 rounded-2xl bg-[#1B4332]/5 border border-[#1B4332]/10 text-center">
        <p className="text-sm text-stone-600 mb-1">
          Still have questions?
        </p>
        <p className="text-xs text-stone-400">
          Use the Export button to save your plan, then reach out with your question — we're happy to help.
        </p>
      </div>
    </div>
  );
}
