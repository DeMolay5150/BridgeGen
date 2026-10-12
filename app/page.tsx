export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="w-full max-w-2xl rounded-xl border border-slate-800/80 bg-slate-900 p-8 md:p-12">
        <p className="font-mono text-xs uppercase tracking-widest text-cyan-400">
          BridgeGen
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-4xl">
          Private Company Decision Simulator
        </h1>
        <p className="mt-4 text-lg leading-8 text-slate-400">
          See the systemic consequences before you make the decision.
        </p>
      </div>
    </main>
  );
}
