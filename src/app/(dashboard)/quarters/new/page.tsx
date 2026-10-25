import { createQuarter } from "../actions";

const now = new Date();
const currentYear = now.getFullYear();
const currentQuarter = Math.floor(now.getMonth() / 3) + 1;

export default function NewQuarterPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-neutral-900">New quarter</h1>
      <div className="card max-w-sm">
        <form action={createQuarter} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm text-neutral-700 block">Year</label>
            <input name="year" type="number" defaultValue={currentYear} required className="input" />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-neutral-700 block">Quarter</label>
            <select name="quarter" defaultValue={currentQuarter} className="input">
              <option value={1}>Q1 (Jan–Mar)</option>
              <option value={2}>Q2 (Apr–Jun)</option>
              <option value={3}>Q3 (Jul–Sep)</option>
              <option value={4}>Q4 (Oct–Dec)</option>
            </select>
          </div>
          <button type="submit" className="btn-primary">
            Create
          </button>
        </form>
      </div>
    </div>
  );
}
