import * as React from "react"

import { cn } from "@/lib/utils"

// 空のインターフェースを削除するか、必要なプロパティを追加します
// 以下の行を削除または修正してください：
// interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

// 代わりに、必要に応じて以下のように書くことができます：
// 例：カスタムプロパティを追加する場合
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  // カスタムプロパティをここに追加
  // 例: customProp?: string;
}

// もしカスタムプロパティが不要な場合は、インターフェースを完全に削除し、
// 直接 React.InputHTMLAttributes<HTMLInputElement> を使用することもできます

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
