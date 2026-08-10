interface CandidateScore {
  hire_success_probability: number
  scoring_reasoning?: { confidence?: string } | null
}

export function TierBadge({ score }: { score: CandidateScore | undefined | null }) {
  if (!score) return null
  const prob = score.hire_success_probability
  const lowConf = score.scoring_reasoning?.confidence === 'low'
  if (prob >= 70 && !lowConf) return <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-800 font-medium">Prioritas</span>
  if (prob >= 40 && !lowConf) return <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800 font-medium">Pertimbangkan</span>
  return <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-medium">Review</span>
}
