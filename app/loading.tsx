export default function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center p-10">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        불러오는 중...
      </div>
    </div>
  );
}
