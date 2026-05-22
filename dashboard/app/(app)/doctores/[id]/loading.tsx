import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"

export default function Loading() {
  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <Skeleton className="h-4 w-28" />

      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <Skeleton className="h-8 w-52" />
              <div className="flex gap-1">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-24 rounded-full" />
              </div>
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-36" />
            </div>
            <Skeleton className="h-8 w-20" />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex gap-1">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-32" />
        </div>
        <Card>
          <CardContent className="pt-6 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
