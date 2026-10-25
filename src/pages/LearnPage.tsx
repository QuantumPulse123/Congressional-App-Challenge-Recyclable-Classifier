import * as React from "react"
import {
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  CloudRain,
  ExternalLink,
  Lightbulb,
  Recycle,
  RotateCcw,
  Trophy,
  Trees,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  LESSONS,
  type Lesson,
  type LessonIcon,
  type QuestionStep,
} from "@/data/lessons"

type SavedLearningProgress = {
  completedLessonIds: string[]
  bestScores: Record<string, { correct: number; total: number }>
}

type CompletionSummary = {
  lessonId: string
  correct: number
  total: number
}

const STORAGE_KEY = "ecoreport-learning-progress-v1"

function readSavedProgress(): SavedLearningProgress {
  if (typeof window === "undefined") {
    return { completedLessonIds: [], bestScores: {} }
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { completedLessonIds: [], bestScores: {} }

    const parsed = JSON.parse(raw) as Partial<SavedLearningProgress>
    const completedLessonIds = Array.isArray(parsed.completedLessonIds)
      ? parsed.completedLessonIds.filter(
          (value): value is string =>
            typeof value === "string" && LESSONS.some((lesson) => lesson.id === value)
        )
      : []

    const bestScores: SavedLearningProgress["bestScores"] = {}
    if (parsed.bestScores && typeof parsed.bestScores === "object") {
      for (const lesson of LESSONS) {
        const score = parsed.bestScores[lesson.id]
        if (
          score &&
          Number.isFinite(score.correct) &&
          Number.isFinite(score.total) &&
          score.correct >= 0 &&
          score.total >= 0
        ) {
          bestScores[lesson.id] = {
            correct: score.correct,
            total: score.total,
          }
        }
      }
    }

    return { completedLessonIds, bestScores }
  } catch {
    return { completedLessonIds: [], bestScores: {} }
  }
}

function LessonIconView({
  icon,
  className = "size-6",
}: {
  icon: LessonIcon
  className?: string
}) {
  const Icon =
    icon === "cloud-rain" ? CloudRain : icon === "recycle" ? Recycle : Trees

  return <Icon className={className} aria-hidden="true" />
}

function scoreLesson(
  lesson: Lesson,
  answers: Record<string, string>,
  checkedQuestions: Set<string>
): CompletionSummary {
  const questions = lesson.steps
    .map((step, index) => ({ step, index }))
    .filter(
      (entry): entry is { step: QuestionStep; index: number } =>
        entry.step.type === "question"
    )

  const correct = questions.filter(({ step, index }) => {
    const key = `${lesson.id}:${index}`
    return checkedQuestions.has(key) && answers[key] === step.correctOptionId
  }).length

  return { lessonId: lesson.id, correct, total: questions.length }
}

export default function LearnPage() {
  const [progress, setProgress] = React.useState<SavedLearningProgress>(readSavedProgress)
  const [activeLessonId, setActiveLessonId] = React.useState<string | null>(null)
  const [stepIndex, setStepIndex] = React.useState(0)
  const [answers, setAnswers] = React.useState<Record<string, string>>({})
  const [checkedQuestions, setCheckedQuestions] = React.useState<Set<string>>(new Set())
  const [completionSummary, setCompletionSummary] = React.useState<CompletionSummary | null>(null)

  React.useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
    } catch {
      // The lessons still work if browser storage is disabled or full.
    }
  }, [progress])

  const activeLesson = LESSONS.find((lesson) => lesson.id === activeLessonId) ?? null
  const currentStep = activeLesson?.steps[stepIndex] ?? null
  const currentQuestionKey = activeLesson ? `${activeLesson.id}:${stepIndex}` : ""
  const currentAnswer = answers[currentQuestionKey]
  const questionChecked = checkedQuestions.has(currentQuestionKey)
  const completedCount = progress.completedLessonIds.length
  const overallProgress = (completedCount / LESSONS.length) * 100

  function startLesson(lesson: Lesson) {
    setActiveLessonId(lesson.id)
    setStepIndex(0)
    setCompletionSummary(null)
    setAnswers((previous) =>
      Object.fromEntries(
        Object.entries(previous).filter(([key]) => !key.startsWith(`${lesson.id}:`))
      )
    )
    setCheckedQuestions((previous) => {
      const next = new Set(previous)
      for (const key of next) {
        if (key.startsWith(`${lesson.id}:`)) next.delete(key)
      }
      return next
    })
  }

  function returnToLessons() {
    setActiveLessonId(null)
    setStepIndex(0)
  }

  function chooseAnswer(optionId: string) {
    if (!activeLesson) return
    setAnswers((previous) => ({ ...previous, [currentQuestionKey]: optionId }))
    setCheckedQuestions((previous) => {
      const next = new Set(previous)
      next.delete(currentQuestionKey)
      return next
    })
  }

  function checkAnswer() {
    if (!currentAnswer || !currentQuestionKey) return
    setCheckedQuestions((previous) => new Set(previous).add(currentQuestionKey))
  }

  function retryQuestion() {
    setAnswers((previous) => {
      const next = { ...previous }
      delete next[currentQuestionKey]
      return next
    })
    setCheckedQuestions((previous) => {
      const next = new Set(previous)
      next.delete(currentQuestionKey)
      return next
    })
  }

  function finishLesson(lesson: Lesson) {
    const summary = scoreLesson(lesson, answers, checkedQuestions)
    setProgress((previous) => {
      const previousBest = previous.bestScores[lesson.id]
      const newIsBetter =
        !previousBest ||
        summary.correct > previousBest.correct ||
        (summary.correct === previousBest.correct && summary.total >= previousBest.total)

      return {
        completedLessonIds: previous.completedLessonIds.includes(lesson.id)
          ? previous.completedLessonIds
          : [...previous.completedLessonIds, lesson.id],
        bestScores: {
          ...previous.bestScores,
          ...(newIsBetter ? { [lesson.id]: { correct: summary.correct, total: summary.total } } : {}),
        },
      }
    })
    setCompletionSummary(summary)
    setActiveLessonId(null)
    setStepIndex(0)
  }

  function goNext() {
    if (!activeLesson || !currentStep) return
    if (currentStep.type === "question" && !questionChecked) return

    if (stepIndex < activeLesson.steps.length - 1) {
      setStepIndex((index) => index + 1)
      return
    }

    finishLesson(activeLesson)
  }

  function goPrevious() {
    if (stepIndex > 0) {
      setStepIndex((index) => index - 1)
      return
    }
    returnToLessons()
  }

  if (activeLesson && currentStep) {
    const stepProgress = ((stepIndex + 1) / activeLesson.steps.length) * 100

    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="border-b bg-background px-4 py-3">
          <Button variant="ghost" size="sm" className="-ml-2 mb-2 gap-1" onClick={returnToLessons}>
            <ChevronLeft className="size-4" />
            All lessons
          </Button>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <LessonIconView icon={activeLesson.icon} className="size-5 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-semibold">{activeLesson.title}</p>
                <p className="text-xs text-muted-foreground">
                  Step {stepIndex + 1} of {activeLesson.steps.length}
                </p>
              </div>
            </div>
            <Badge variant="secondary">{Math.round(stepProgress)}%</Badge>
          </div>
          <Progress value={stepProgress} className="mt-3 h-1.5" />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
          <Card className="border shadow-sm">
            <CardContent className="space-y-4 p-4 sm:p-5">
              {currentStep.type === "reading" ? (
                <>
                  <div className="flex items-center gap-2">
                    <Lightbulb className="size-5 shrink-0 text-primary" />
                    <h2 className="text-lg font-semibold leading-tight">{currentStep.title}</h2>
                  </div>
                  <div className="space-y-3 text-sm leading-6 text-foreground/90">
                    {currentStep.paragraphs.map((paragraph, index) => (
                      <p key={`${activeLesson.id}-${stepIndex}-p${index}`}>{paragraph}</p>
                    ))}
                  </div>
                  {currentStep.bullets && (
                    <ul className="space-y-2 pl-5 text-sm leading-6 text-foreground/90 list-disc">
                      {currentStep.bullets.map((bullet) => (
                        <li key={bullet}>{bullet}</li>
                      ))}
                    </ul>
                  )}
                  {currentStep.note && (
                    <div className="rounded-lg bg-muted/60 p-3 text-sm leading-5">
                      {currentStep.note}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <BookOpen className="size-5 shrink-0 text-primary" />
                    <h2 className="text-lg font-semibold leading-tight">{currentStep.title}</h2>
                  </div>
                  <p className="text-sm leading-6">{currentStep.prompt}</p>
                  <div className="space-y-2" role="group" aria-label="Answer choices">
                    {currentStep.options.map((option) => {
                      const selected = currentAnswer === option.id
                      const correctOption = option.id === currentStep.correctOptionId
                      let optionClass = "h-auto min-h-11 w-full justify-start whitespace-normal py-3 text-left font-normal"

                      if (questionChecked && correctOption) {
                        optionClass += " border-green-600 bg-green-50 text-green-950 hover:bg-green-50 dark:border-green-400 dark:bg-green-950/60 dark:text-green-100 dark:hover:bg-green-950/60"
                      } else if (questionChecked && selected && !correctOption) {
                        optionClass += " border-destructive bg-destructive/10 text-foreground hover:bg-destructive/10 dark:border-destructive dark:bg-destructive/20 dark:hover:bg-destructive/25"
                      } else if (selected) {
                        optionClass += " border-primary bg-primary/10 text-foreground ring-1 ring-primary hover:bg-primary/15 dark:border-primary dark:bg-primary/20 dark:text-foreground dark:hover:bg-primary/25"
                      }

                      return (
                        <Button
                          key={option.id}
                          type="button"
                          variant="outline"
                          className={optionClass}
                          aria-pressed={selected}
                          onClick={() => chooseAnswer(option.id)}
                        >
                          <span className={`mr-2 inline-flex size-6 shrink-0 items-center justify-center rounded-full border text-xs ${selected ? "border-primary bg-primary text-primary-foreground" : "border-current/30"}`}>
                            {option.id.toUpperCase()}
                          </span>
                          <span className="whitespace-normal text-left">{option.text}</span>
                        </Button>
                      )
                    })}
                  </div>

                  {!questionChecked ? (
                    <Button className="w-full" onClick={checkAnswer} disabled={!currentAnswer}>
                      Check answer
                    </Button>
                  ) : (
                    <div className="space-y-3">
                      <div className="rounded-lg bg-muted/60 p-3">
                        <div className="mb-1 flex items-center gap-2">
                          <CheckCircle2 className="size-4 text-primary" />
                          <p className="text-sm font-semibold">
                            {currentAnswer === currentStep.correctOptionId ? "That's right" : "Here's why"}
                          </p>
                        </div>
                        <p className="text-sm leading-5">
                          {currentAnswer === currentStep.correctOptionId
                            ? currentStep.correctFeedback
                            : currentStep.incorrectFeedback}
                        </p>
                      </div>
                      {currentAnswer !== currentStep.correctOptionId && (
                        <Button variant="outline" className="w-full" onClick={retryQuestion}>
                          <RotateCcw className="mr-2 size-4" />
                          Try again
                        </Button>
                      )}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {stepIndex === activeLesson.steps.length - 1 && (
            <Card className="mt-3 border-primary/20 bg-primary/5 shadow-none">
              <CardContent className="flex gap-3 p-4">
                <Trophy className="mt-0.5 size-5 shrink-0 text-primary" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold">One thing to remember</p>
                  <p className="text-sm leading-5 text-muted-foreground">{activeLesson.takeaway}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t bg-background p-3">
          <Button variant="outline" onClick={goPrevious} className="gap-1">
            <ChevronLeft className="size-4" />
            Back
          </Button>
          <Button
            onClick={goNext}
            disabled={currentStep.type === "question" && !questionChecked}
            className="gap-1"
          >
            {stepIndex === activeLesson.steps.length - 1 ? "Complete lesson" : "Continue"}
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b bg-background px-4 py-4">
        <div className="flex items-center gap-2">
          <BookOpen className="size-5 text-primary" />
          <p className="text-sm font-semibold">Learn</p>
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Understand the world around you.</h1>
        <p className="mt-2 text-sm leading-5 text-muted-foreground">
          Explore how everyday choices affect the environment. Each short lesson includes questions, explanations, and a practical takeaway.
        </p>
        <div className="mt-4 rounded-lg bg-muted/60 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-sm font-medium">Your learning progress</span>
            <span className="text-xs text-muted-foreground">{completedCount} of {LESSONS.length} complete</span>
          </div>
          <Progress value={overallProgress} className="h-2" />
          <p className="mt-2 text-xs text-muted-foreground">Progress is saved in this browser on this device. No account needed.</p>
        </div>
      </div>

      <div className="flex-1 min-h-0 space-y-3 overflow-y-auto px-4 py-4">
        {completionSummary && (
          <Card className="border-primary/30 bg-primary/5 shadow-none">
            <CardContent className="flex items-start gap-3 p-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-background">
                <Trophy className="size-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">Lesson completed!</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  You got {completionSummary.correct} of {completionSummary.total} questions right in {LESSONS.find((lesson) => lesson.id === completionSummary.lessonId)?.title ?? "this lesson"}.
                </p>
                <Badge variant="secondary" className="mt-2 gap-1">
                  <CheckCircle2 className="size-3" />
                  Lesson badge earned
                </Badge>
              </div>
              <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={() => setCompletionSummary(null)} aria-label="Dismiss completion message">
                ×
              </Button>
            </CardContent>
          </Card>
        )}

        {LESSONS.map((lesson, index) => {
          const completed = progress.completedLessonIds.includes(lesson.id)
          const bestScore = progress.bestScores[lesson.id]
          return (
            <Card key={lesson.id} className="shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <LessonIconView icon={lesson.icon} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-muted-foreground">LESSON {String(index + 1).padStart(2, "0")}</span>
                      {completed && <Badge variant="secondary" className="gap-1"><CheckCircle2 className="size-3" />Completed</Badge>}
                    </div>
                    <h2 className="mt-1 font-semibold leading-tight">{lesson.title}</h2>
                    <p className="mt-1 text-sm leading-5 text-muted-foreground">{lesson.description}</p>
                    <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="size-3.5" />
                      About {lesson.durationMinutes} minutes
                    </div>
                    {bestScore && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Best quiz result: {bestScore.correct} of {bestScore.total}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-3 rounded-md bg-muted/50 px-3 py-2">
                  <p className="text-xs font-medium">What you'll learn</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{lesson.goal}</p>
                </div>
                <Button className="mt-3 w-full" variant={completed ? "outline" : "default"} onClick={() => startLesson(lesson)}>
                  {completed ? "Review lesson" : "Start lesson"}
                  <ChevronRight className="ml-1 size-4" />
                </Button>
              </CardContent>
            </Card>
          )
        })}

        <div className="rounded-lg border p-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="size-4 text-primary" />
            <p className="text-sm font-semibold">Want to learn more?</p>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            These lessons are a starting point. Explore the trusted resources below for more detail.
          </p>
          <div className="mt-2 space-y-2">
            {LESSONS.flatMap((lesson) => lesson.sources).map((source) => (
              <a
                key={source.url}
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-sm text-primary underline underline-offset-2"
              >
                <ExternalLink className="size-3.5 shrink-0" />
                <span>{source.label}</span>
              </a>
            ))}
          </div>
        </div>

        <p className="pb-1 text-center text-xs text-muted-foreground">
          Small, informed choices can add up. Keep exploring and share what you learn.
        </p>
      </div>
    </div>
  )
}
