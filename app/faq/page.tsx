import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Frequently asked questions about ContraMRR.",
};

const faqs = [
  {
    question: "What is ContraMRR?",
    answer:
      "ContraMRR ranks freelancers on Contra by their estimated monthly recurring revenue, in a clean, simple table.",
  },
  {
    question: "How is MRR estimated?",
    answer:
      "Each freelancer's public lifetime earnings badge (e.g. \"$750k+\") is divided evenly across 24 months. It is an approximation, not an exact figure.",
  },
  {
    question: "Where does the data come from?",
    answer:
      "Data is collected from publicly available Contra profiles, including earnings badges, hire counts, and ratings.",
  },
];

export default function FaqPage() {
  return (
    <main className="flex min-h-screen w-full flex-col gap-6 bg-zinc-50 px-3 pb-8 pt-8">
      <div className="mx-auto w-full max-w-3xl">
        <h1 className="text-2xl font-semibold text-zinc-900">FAQ</h1>
        <dl className="mt-6 flex flex-col gap-6">
          {faqs.map((faq) => (
            <div
              key={faq.question}
              className="rounded-lg border border-zinc-200 bg-white p-6"
            >
              <dt className="text-sm font-semibold text-zinc-900">
                {faq.question}
              </dt>
              <dd className="mt-2 text-sm leading-relaxed text-zinc-600">
                {faq.answer}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </main>
  );
}
