"use client"

import { useState, useEffect, useMemo } from 'react'
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts'
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ReloadIcon } from "@radix-ui/react-icons"

const categories = ["現実的", "研究的", "芸術的", "社会的", "企業的", "慣習的"]

interface JobScore {
  name: string;
  scores: (number | null)[];
  description: string;
}

function normalizeScores(scores: (number | null)[]): number[] {
  const validScores = scores.filter((score): score is number => score !== null);
  const min = Math.min(...validScores);
  const max = Math.max(...validScores);
  if (min === max) {
    return scores.map(() => 1); // すべてのスコアが同じ場合は1を返す
  }
  return scores.map(score => score === null ? 0 : (score - min) / (max - min));
}

function weightedCosineSimilarity(a: number[], b: (number | null)[]): number {
  const weights = [1.0, 1.0, 1.0, 1.0, 1.0, 1.0]; // 重み付け：すべてのカテゴリに等しく重みを付ける
  const normalizedA = normalizeScores(a);
  const normalizedB = normalizeScores(b);
  
  const validPairs = normalizedA.map((val, i) => [val, normalizedB[i], weights[i]]).filter(([_val, bVal]) => bVal !== null) as [number, number, number][];
  
  if (validPairs.length === 0) return 0;

  const dotProduct = validPairs.reduce((sum, [aVal, bVal, weight]) => sum + aVal * bVal * weight, 0);
  const magnitudeA = Math.sqrt(validPairs.reduce((sum, [aVal, _bVal, weight]) => sum + aVal * aVal * weight * weight, 0));
  const magnitudeB = Math.sqrt(validPairs.reduce((sum, [_aVal, bVal, weight]) => sum + bVal * bVal * weight * weight, 0));
  
  if (magnitudeA === 0 && magnitudeB === 0) return 1; // 両方のベクトルが0の場合は完全に一致していると見なす
  if (magnitudeA === 0 || magnitudeB === 0) return 0;
  
  return Math.min(Math.max(dotProduct / (magnitudeA * magnitudeB), -1), 1);
}

function combinedSimilarity(a: number[], b: (number | null)[]): number {
  const cosineSim = weightedCosineSimilarity(a, b);
  
  // 絶対値の差を計算
  const validPairs = a.map((val, i) => [val, b[i]]).filter(([, bVal]) => bVal !== null) as [number, number][];
  const avgDifference = validPairs.reduce((sum, [aVal, bVal]) => sum + Math.abs(aVal - bVal), 0) / validPairs.length;
  const normalizedDifference = 1 - (avgDifference / 100); // 0-1の範囲に正規化

  // コサイン類似度と絶対値の差を組み合わせる（重みは調整可能）
  return 0.7 * cosineSim + 0.3 * normalizedDifference;
}

function calculateStandardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squareDiffs = values.map(value => Math.pow(value - mean, 2));
  const avgSquareDiff = squareDiffs.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(avgSquareDiff);
}

function interpretSimilarityTrend(similarities: number[], userScores: number[]): string {
  if (similarities.length === 0) {
    return "類似度データがありません。職業データが正しく読み込まれているか確認してください。";
  }

  const validSimilarities = similarities.filter(val => !isNaN(val) && isFinite(val));
  if (validSimilarities.length === 0) {
    return "有効な類似度データがありません。データの形式を確認してください。";
  }

  const avgSimilarity = validSimilarities.reduce((sum, val) => sum + val, 0) / validSimilarities.length;
  const stdDeviation = calculateStandardDeviation(validSimilarities);

  const avgUserScore = userScores.reduce((sum, score) => sum + score, 0) / userScores.length;
  const maxUserScore = Math.max(...userScores);
  const minUserScore = Math.min(...userScores);
  const userScoreRange = maxUserScore - minUserScore;

  let interpretation = `平均類似度は${avgSimilarity.toFixed(2)}で、標準偏差は${stdDeviation.toFixed(2)}です。\n`;

  interpretation += `あなたの興味の強さの平均は${avgUserScore.toFixed(2)}です。`;

  if (userScoreRange > 50) {
    interpretation += "\n\n興味の強さに大きな差があります。";
    const maxCategory = categories[userScores.indexOf(maxUserScore)];
    interpretation += `特に「${maxCategory}」の分野に強い興味（${maxUserScore}点）を示しています。`;
    
    if (avgUserScore < 30) {
      interpretation += "他の分野への興味は比較的低いようです。この特定の分野に焦点を当てたキャリアを検討するのも良いでしょう。";
    } else {
      interpretation += "他の分野にも一定の興味がありますが、この強い興味を活かせる職業を中心に検討することをお勧めします。";
    }
  } else if (avgUserScore > 75) {
    interpretation += "全体的に強い興味を持っているようです。幅広い分野での活躍が期待できます。";
  } else if (avgUserScore > 50) {
    interpretation += "中程度の興味を持っているようです。興味のバランスが取れていますが、特に高スコアの分野に注目してみるのも良いでしょう。";
  } else if (avgUserScore > 25) {
    interpretation += "やや弱い興味を示していますが、相対的に高いスコアの分野があれば、そこから探索を始めるのが良いかもしれません。";
  } else {
    interpretation += "全体的に弱い興味を示しています。新しい分野を探索したり、これまでに経験したことのない活動に挑戦してみるのも良いかもしれません。";
  }

  if (avgSimilarity > 0.8) {
    interpretation += "\n\nあなたの興味プロフィールは多くの職業と高い類似性を示しています。";
    // ... 既存のコード ...
  } else if (avgSimilarity > 0.6) {
    interpretation += "\n\nあなたの興味プロフィールはいくつかの職業と中程度の類似性を示しています。";
    // ... 既存のコード ...
  } else if (avgSimilarity > 0.4) {
    interpretation += "\n\nあなたの興味プロフィールは一部の職業とのみ類似性を示しています。";
    // ... 既存のコード ...
  } else {
    interpretation += "\n\nあなたの興味プロフィールは多くの職業と低い類似性を示しています。";
    // ... 既存のコード ...
  }

  return interpretation;
}

export default function JobRecommendation() {
  const [userScores, setUserScores] = useState<number[]>(Array(6).fill(50))
  const [inputValues, setInputValues] = useState<string[]>(Array(6).fill("50"))
  const [jobScores, setJobScores] = useState<JobScore[]>([])
  const [recommendations, setRecommendations] = useState<{ name: string; similarity: number; description: string }[]>([])
  const [showAllRecommendations, setShowAllRecommendations] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [trendInterpretation, setTrendInterpretation] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)

  const loadJobScores = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/job-scores.json')
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      const validatedData = data.map((job: JobScore) => ({
        ...job,
        scores: job.scores.map((score: number | null) => 
          typeof score === 'number' && !isNaN(score) ? score : null
        )
      }))
      setJobScores(validatedData)
    } catch (err) {
      console.error("Error loading job scores:", err)
      setError("職業スコアの読み込みに失敗しました。ネットワーク接続を確認し、後でもう一度お試しください。")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadJobScores()
  }, [])

  const handleScoreChange = (index: number, value: string) => {
    const newInputValues = [...inputValues]
    newInputValues[index] = value
    setInputValues(newInputValues)

    const numericValue = value === "" ? 0 : parseFloat(value)
    if (!isNaN(numericValue)) {
      const clampedValue = Math.max(0, Math.min(100, numericValue))
      const newScores = [...userScores]
      newScores[index] = clampedValue
      setUserScores(newScores)
    }
  }

  const calculateRecommendations = useMemo(() => {
    try {
      const results = jobScores.map(job => {
        const similarity = combinedSimilarity(userScores, job.scores);
        return {
          name: job.name,
          similarity,
          description: job.description
        };
      }).sort((a, b) => b.similarity - a.similarity);

      // 類似度の閾値を設定（例: 上位20%のみを表示）
      const threshold = results[Math.floor(results.length * 0.2)]?.similarity || 0;
      const filteredResults = results.filter(job => job.similarity >= threshold);

      const interpretation = interpretSimilarityTrend(filteredResults.map(r => r.similarity), userScores);
      setTrendInterpretation(interpretation);

      return filteredResults;
    } catch (err) {
      console.error("Error in calculateRecommendations:", err);
      setError("推薦の計算中にエラーが発生しました。入力を確認してください。")
      return []
    }
  }, [userScores, jobScores])

  useEffect(() => {
    setRecommendations(calculateRecommendations)
  }, [calculateRecommendations])

  const chartData = categories.map((category, index) => ({
    subject: category,
    score: userScores[index],
    fullMark: 100,
  }))

  const toggleRecommendations = () => {
    setShowAllRecommendations(!showAllRecommendations);
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
        データを読み込んでいます...
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>エラー</AlertTitle>
        <AlertDescription>
          {error}
          <Button onClick={loadJobScores} className="mt-2">
            再試行
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4 text-center">職業興味検査結果入力</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {categories.map((category, index) => (
          <div key={category} className="flex flex-col space-y-2">
            <Label htmlFor={`score-${index}`}>{category}</Label>
            <Input
              id={`score-${index}`}
              type="text"
              inputMode="decimal"
              value={inputValues[index]}
              onChange={(e) => handleScoreChange(index, e.target.value)}
              onBlur={() => {
                const newInputValues = [...inputValues]
                newInputValues[index] = userScores[index].toString()
                setInputValues(newInputValues)
              }}
              className="w-full"
              aria-describedby={`score-${index}-description`}
            />
            <span id={`score-${index}-description`} className="sr-only">
              0から100までの値を入力してください
            </span>
          </div>
        ))}
      </div>
      <div className="mb-8">
        <ResponsiveContainer width="100%" height={300}>
          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
            <PolarGrid />
            <PolarAngleAxis dataKey="subject" />
            <PolarRadiusAxis angle={30} domain={[0, 100]} />
            <Radar
              name="あなたのスコア"
              dataKey="score"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary))"
              fillOpacity={0.6}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <Card className="mb-8">
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold mb-2">全体的な傾向の解釈</h3>
          <p>{trendInterpretation}</p>
        </CardContent>
      </Card>
      <div>
        <h3 className="text-xl font-semibold mb-2">オススメの職種</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>順位</TableHead>
              <TableHead>職種名</TableHead>
              <TableHead>類似度</TableHead>
              <TableHead>簡易説明</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recommendations.slice(0, showAllRecommendations ? undefined : 10).map((job, index) => (
              <TableRow  key={index}>
                <TableCell>{index + 1}</TableCell>
                <TableCell>{job.name}</TableCell>
                <TableCell>{job.similarity.toFixed(4)}</TableCell>
                <TableCell>{job.description}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {recommendations.length > 10 && (
          <Button 
            onClick={toggleRecommendations} 
            className="mt-4"
            aria-expanded={showAllRecommendations}
            aria-controls="recommendations-table"
          >
            {showAllRecommendations ? "結果を一部のみ表示" : `すべての結果を表示（${recommendations.length}職種）`}
          </Button>
        )}
      </div>
      <footer className="mt-8 text-sm text-gray-600 border-t pt-4">
        <p>
          独立行政法人労働政策研究・研修機構（JILPT）作成「職業情報データベース　簡易版数値系ダウンロードデータ　ver.5.00」<br />
          職業情報提供サイト（日本版O-NET）より2024年9月23日にダウンロード<br />
          （https://shigoto.mhlw.go.jp/User/download）を加工して作成
        </p>
      </footer>
    </div>
  )
}