'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface ScoreResult {
  cv_fit_score: number
  attrition_risk_score: number
  hire_success_probability: number
  reasoning: {
    strengths: string[]
    concerns: string[]
    recommendation: string
  }
  cached: boolean
}

function getTier(prob: number): { label: string; color: string } {
  if (prob >= 80) return { label: 'Tier 1 — Prioritize', color: 'bg-green-100 text-green-800' }
  if (prob >= 60) return { label: 'Tier 2 — Consider', color: 'bg-yellow-100 text-yellow-800' }
  return { label: 'Tier 3 — Review Manual', color: 'bg-gray-100 text-gray-600' }
}

export function ScoreCard({ candidateId }: { candidateId: string }) {
  const [score, setScore] = useState<ScoreResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function fetchScore() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/ai/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate_id: candidateId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setScore(data)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const tier = score ? getTier(score.hire_success_probability) : null

  return (
    <div className="bg-white rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">AI Scoring</h3>
        <Button size="sm" variant="outline" onClick={fetchScore} disabled={loading}>
          {loading ? 'Menghitung...' : score ? 'Refresh' : 'Hitung Skor'}
        </Button>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {score && (
        <>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-2xl font-bold text-[#1E3A2F]">{score.cv_fit_score}</p>
              <p className="text-xs text-gray-500">CV Fit</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">{score.hire_success_probability}</p>
              <p className="text-xs text-gray-500">Probabilitas Hire</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-500">{score.attrition_risk_score}</p>
              <p className="text-xs text-gray-400">Risiko Attrisi*</p>
            </div>
          </div>

          <div className={`text-xs px-2 py-1 rounded-full font-medium inline-block ${tier!.color}`}>
            {tier!.label}
          </div>

          {score.reasoning.strengths.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-600 mb-1">Kekuatan:</p>
              <ul className="text-xs text-gray-600 space-y-0.5">
                {score.reasoning.strengths.map((s, i) => <li key={i}>• {s}</li>)}
              </ul>
            </div>
          )}

          {score.reasoning.concerns.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-600 mb-1">Perlu ditanyakan saat interview:</p>
              <ul className="text-xs text-gray-600 space-y-0.5">
                {score.reasoning.concerns.map((c, i) => <li key={i}>• {c}</li>)}
              </ul>
            </div>
          )}

          {score.reasoning.recommendation && (
            <div className="bg-blue-50 rounded p-2">
              <p className="text-xs text-blue-700">{score.reasoning.recommendation}</p>
            </div>
          )}

          <p className="text-xs text-gray-400">
            * Skor ini hanya catatan untuk HR — bukan penentu keputusan otomatis.
            {score.cached && ' (dari cache)'}
          </p>
        </>
      )}
    </div>
  )
}
