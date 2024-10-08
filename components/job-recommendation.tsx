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
  return scores.map(score => score === null ? 0 : (score - min) / (max - min));
}

function weightedCosineSimilarity(a: number[], b: (number | null)[]): number {
  const weights = [1.2, 1.1, 1.0, 1.0, 0.9, 0.8]; // 重み付け：現実的と研究的により重点を置く
  const normalizedA = normalizeScores(a);
  const normalizedB = normalizeScores(b);
  
  const validPairs = normalizedA.map((val, i) => [val, normalizedB[i], weights[i]]).filter(([, bVal]) => bVal !== null) as [number, number, number][];
  const dotProduct = validPairs.reduce((sum, [aVal, bVal, weight]) => sum + aVal * bVal * weight, 0);
  const magnitudeA = Math.sqrt(validPairs.reduce((sum, [aVal, , weight]) => sum + aVal * aVal * weight * weight, 0));
  const magnitudeB = Math.sqrt(validPairs.reduce((sum, [, bVal, weight]) => sum + bVal * bVal * weight * weight, 0));
  
  return dotProduct / (magnitudeA * magnitudeB) || 0;
}

function calculateStandardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squareDiffs = values.map(value => Math.pow(value - mean, 2));
  const avgSquareDiff = squareDiffs.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(avgSquareDiff);
}

function interpretSimilarityTrend(similarities: number[]): string {
  if (similarities.length === 0) {
    return "類似度データがありません。職業データが正しく読み込まれているか確認してください。";
  }

  const validSimilarities = similarities.filter(val => !isNaN(val) && isFinite(val));
  if (validSimilarities.length === 0) {
    return "有効な類似度データがありません。データの形式を確認してください。";
  }

  const avgSimilarity = validSimilarities.reduce((sum, val) => sum + val, 0) / validSimilarities.length;
  const stdDeviation = calculateStandardDeviation(validSimilarities);

  let interpretation = `平均類似度は${avgSimilarity.toFixed(2)}で、標準偏差は${stdDeviation.toFixed(2)}です。\n`;

  if (avgSimilarity > 0.8) {
    interpretation += "あなたの興味プロフィールは多くの職業と高い類似性を示しています。";
    if (stdDeviation < 0.1) {
      interpretation += "また、類似度の分布が狭いため、幅広い職種に対して一貫して高い適性がある可能性があります。";
    } else {
      interpretation += "ただし、類似度にばらつきがあるため、特に類似度の高い職種に注目することをお勧めします。";
    }
  } else if (avgSimilarity > 0.6) {
    interpretation += "あなたの興味プロフィールはいくつかの職業と中程度の類似性を示しています。";
    if (stdDeviation < 0.15) {
      interpretation += "類似度の分布が比較的狭いため、特定の分野に一貫した興味や適性がある可能性があります。";
    } else {
      interpretation += "類似度にばらつきがあるため、最も類似度の高い職種をより詳しく探ることをお勧めします。";
    }
  } else if (avgSimilarity > 0.4) {
    interpretation += "あなたの興味プロフィールは一部の職業とのみ類似性を示しています。";
    if (stdDeviation < 0.2) {
      interpretation += "類似度の分布が比較的狭いため、特定の職種に強い興味や適性がある可能性が高いです。";
    } else {
      interpretation += "類似度にばらつきがあるため、最も類似度の高い数個の職種に焦点を当てて検討することをお勧めします。";
    }
  } else {
    interpretation += "あなたの興味プロフィールは多くの職業と低い類似性を示しています。";
    if (stdDeviation < 0.1) {
      interpretation += "類似度の分布が狭いため、既存の職業カテゴリーとは異なる独特な興味や適性を持っている可能性が高いです。新しい分野や独自のキャリアパスを探索することをお勧めします。";
    } else {
      interpretation += "類似度にばらつきがあるため、最も類似度の高い職種をより詳しく調べつつ、新しい分野や独自のキャリアパスも探索することをお勧めします。";
    }
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
      const validatedData = data.map((job: { scores: number[]}) => ({
        ...job,
        scores: job.scores.map((score: number) => 
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
        const similarity = weightedCosineSimilarity(userScores, job.scores);
        return {
          name: job.name,
          similarity,
          description: job.description
        };
      }).sort((a, b) => b.similarity - a.similarity);

      // 類似度の閾値を設定（例: 上位20%のみを表示）
      const threshold = results[Math.floor(results.length * 0.2)]?.similarity || 0;
      const filteredResults = results.filter(job => job.similarity >= threshold);

      const interpretation = interpretSimilarityTrend(filteredResults.map(r => r.similarity));
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
              <TableRow key={index}>
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