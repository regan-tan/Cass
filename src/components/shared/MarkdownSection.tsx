import LoadingDots from "./LoadingDots";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/cjs/styles/prism";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";

const transparentOneDark: Record<string, any> = Object.entries(oneDark).reduce(
  (acc, [selector, style]) => {
    acc[selector] = { ...(style as any), background: "transparent" };
    return acc;
  },
  {} as Record<string, any>
);

export const MarkdownSection = ({
  content,
  isLoading,
}: {
  content: string | null;
  isLoading: boolean;
}) => {
  return (
    <div className="space-y-2">
      {isLoading && !content ? (
        <div className="w-full flex flex-row items-center justify-start">
          <LoadingDots size={4} color={"#FAFAFA"} gap={4} />
        </div>
      ) : content ? (
        <div className="w-full text-xs">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
            components={{
              h1: ({ node, ...props }) => (
                <h1 className="text-xs font-bold mb-2" {...props} />
              ),
              h2: ({ node, ...props }) => (
                <h2 className="text-xs font-bold mb-2" {...props} />
              ),
              h3: ({ node, ...props }) => (
                <h3 className="text-xs font-bold mb-1" {...props} />
              ),
              p: ({ node, ...props }) => (
                <p className="mb-2 text-xs" {...props} />
              ),
              ul: ({ node, ...props }) => (
                <ul className="list-disc ml-4 mb-2 text-xs" {...props} />
              ),
              ol: ({ node, ...props }) => (
                <ol className="list-decimal ml-4 mb-2 text-xs" {...props} />
              ),
              li: ({ node, ...props }) => (
                <li className="mb-1 text-xs" {...props} />
              ),
              table: ({ node, ...props }) => (
                <div className="overflow-x-auto my-2">
                  <table className="min-w-full border" {...props} />
                </div>
              ),
              thead: ({ node, ...props }) => (
                <thead className="bg-muted" {...props} />
              ),
              tbody: ({ node, ...props }) => <tbody {...props} />,
              tr: ({ node, ...props }) => (
                <tr className="border-b" {...props} />
              ),
              th: ({ node, ...props }) => (
                <th
                  className="px-4 py-2 text-left text-foreground"
                  {...props}
                />
              ),
              td: ({ node, ...props }) => (
                <td className="px-4 py-2 border-r last:border-r-0" {...props} />
              ),
              pre: ({ node, ...props }) => (
                <pre
                  className="overflow-x-auto rounded text-muted-foreground text-xs whitespace-pre-wrap"
                  {...props}
                />
              ),
              code: ({ node, inline, className, children, ...props }: any) => {
                const match = /language-(\w+)/.exec(className || "");

                return !inline && match ? (
                  <SyntaxHighlighter
                    style={transparentOneDark}
                    customStyle={{
                      margin: 0,
                      padding: 0,
                      paddingBottom: "8px",
                    }}
                    PreTag="div"
                    language={match[1]}
                    {...props}
                  >
                    {String(children).replace(/\n$/, "")}
                  </SyntaxHighlighter>
                ) : (
                  <code className="font-mono text-xs" {...props}>
                    {children}
                  </code>
                );
              },
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      ) : null}
    </div>
  );
};
