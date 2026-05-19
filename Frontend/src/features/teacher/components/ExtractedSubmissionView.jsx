import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import {
    tryParseIpynb,
    listNotebookCells,
    normalizeTextBlock,
    splitPlainParagraphs,
    notebookKernelspecLanguage,
} from '../../../lib/ipynbDocument';

const mdComponents = {
    p: (props) => <p className="mb-3 last:mb-0 text-[15px] leading-relaxed text-slate-800 dark:text-slate-200" {...props} />,
    h1: (props) => <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-4 mb-2 first:mt-0" {...props} />,
    h2: (props) => <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-4 mb-2 first:mt-0" {...props} />,
    h3: (props) => <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-3 mb-1.5" {...props} />,
    ul: (props) => <ul className="list-disc pl-5 mb-3 space-y-1 text-[15px] text-slate-800 dark:text-slate-200" {...props} />,
    ol: (props) => <ol className="list-decimal pl-5 mb-3 space-y-1 text-[15px] text-slate-800 dark:text-slate-200" {...props} />,
    li: (props) => <li className="leading-relaxed" {...props} />,
    a: (props) => <a className="text-[#1D68E3] underline font-medium break-all" target="_blank" rel="noopener noreferrer" {...props} />,
    code: ({ inline, className, children, ...props }) =>
        inline ? (
            <code
                className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[0.9em] font-mono text-rose-700 dark:text-rose-300"
                {...props}
            >
                {children}
            </code>
        ) : (
            <code className={`text-sm font-mono text-slate-100 ${className || ''}`} {...props}>
                {children}
            </code>
        ),
    pre: (props) => (
        <pre className="mb-3 overflow-x-auto rounded-lg bg-slate-900 p-3 text-sm leading-relaxed border border-slate-800">{props.children}</pre>
    ),
    blockquote: (props) => (
        <blockquote
            className="border-l-4 border-[#1D68E3]/40 pl-4 my-3 text-slate-600 dark:text-slate-400 italic"
            {...props}
        />
    ),
    hr: () => <hr className="my-6 border-slate-200 dark:border-slate-700" />,
    table: (props) => (
        <div className="overflow-x-auto my-3">
            <table className="min-w-full text-sm border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden" {...props} />
        </div>
    ),
    th: (props) => <th className="border border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 px-2 py-1 text-left font-bold" {...props} />,
    td: (props) => <td className="border border-slate-200 dark:border-slate-700 px-2 py-1" {...props} />,
};

function NotebookCell({ cell, highlightNorms, defaultLang }) {
    const n = normalizeTextBlock(cell.source);
    const match = highlightNorms && n && highlightNorms.has(n);
    const shell = `rounded-xl border overflow-hidden mb-4 last:mb-0 ${
        match ? 'border-amber-300 dark:border-amber-700/60 ring-1 ring-amber-200/80 dark:ring-amber-900/40' : 'border-slate-200 dark:border-slate-700'
    }`;

    if (cell.type === 'markdown') {
        return (
            <div className={shell}>
                <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest bg-slate-100 dark:bg-slate-800/80 text-slate-500 border-b border-slate-200 dark:border-slate-700">
                    Markdown
                </div>
                <div className="px-4 py-3 bg-white dark:bg-[#0f172a]">
                    {cell.source.trim() ? (
                        <div className="prose-notebook">
                            <ReactMarkdown components={mdComponents}>{cell.source}</ReactMarkdown>
                        </div>
                    ) : (
                        <p className="text-sm text-slate-400 italic">Empty markdown cell</p>
                    )}
                </div>
            </div>
        );
    }

    if (cell.type === 'code') {
        return (
            <div className={shell}>
                <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest bg-slate-800 text-slate-300 border-b border-slate-700 flex justify-between gap-2">
                    <span>Code {defaultLang ? `· ${defaultLang}` : ''}</span>
                    <span>Cell {cell.index + 1}</span>
                </div>
                <div className="bg-slate-950 text-slate-100">
                    <pre className="p-4 overflow-x-auto text-[13px] leading-relaxed font-mono whitespace-pre-wrap border-b border-slate-800">
                        <code>{cell.source || ' '}</code>
                    </pre>
                    {cell.outputsSummary ? (
                        <div>
                            <div className="px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-900 border-t border-slate-800">
                                Output
                            </div>
                            <pre className="p-4 overflow-x-auto text-[12px] leading-relaxed font-mono whitespace-pre-wrap text-slate-200 max-h-[320px] overflow-y-auto">
                                {cell.outputsSummary}
                            </pre>
                        </div>
                    ) : null}
                </div>
            </div>
        );
    }

    return (
        <div className={shell}>
            <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border-b border-amber-100 dark:border-amber-900/50">
                Raw
            </div>
            <pre className="p-4 text-sm font-mono whitespace-pre-wrap bg-white dark:bg-[#0f172a] text-slate-800 dark:text-slate-200 max-h-[400px] overflow-y-auto">
                {cell.source || ' '}
            </pre>
        </div>
    );
}

/**
 * Renders extracted submission text: Jupyter notebooks as structured cells; otherwise Word-style paragraphs.
 */
export default function ExtractedSubmissionView({ text, filename, highlightNorms }) {
    const nb = useMemo(() => tryParseIpynb(text), [text]);
    const cells = useMemo(() => (nb ? listNotebookCells(nb) : []), [nb]);
    const kernelLang = useMemo(() => (nb ? notebookKernelspecLanguage(nb) : ''), [nb]);

    const looksTruncatedNotebook =
        !nb &&
        String(filename || '').toLowerCase().endsWith('.ipynb') &&
        String(text || '').trim().startsWith('{') &&
        String(text || '').includes('"cells"');

    if (nb && cells.length) {
        return (
            <div className="space-y-1">
                <p className="text-[11px] font-bold text-slate-500 mb-3">
                    Notebook structure: {cells.length} cell{cells.length === 1 ? '' : 's'}
                    {kernelLang ? ` · kernel: ${kernelLang}` : ''}
                </p>
                {cells.map((cell) => (
                    <NotebookCell key={cell.index} cell={cell} highlightNorms={highlightNorms} defaultLang={kernelLang} />
                ))}
            </div>
        );
    }

    if (looksTruncatedNotebook) {
        return (
            <div className="rounded-lg border border-amber-200 bg-amber-50/80 dark:bg-amber-950/20 dark:border-amber-800 p-4 text-sm text-amber-900 dark:text-amber-100 mb-4">
                <p className="font-bold mb-1">Notebook preview incomplete</p>
                <p className="text-xs leading-relaxed opacity-90">
                    Stored text may be truncated on the server, so the notebook could not be parsed as JSON. Download the
                    original <span className="font-mono">.ipynb</span> file to open it in Jupyter or VS Code.
                </p>
            </div>
        );
    }

    const blocks = splitPlainParagraphs(text);
    if (blocks.length === 0) {
        return <p className="text-sm text-slate-400 font-medium">No extracted text for this file.</p>;
    }

    return (
        <div className="space-y-4 text-[15px] leading-[1.75] text-slate-800 dark:text-slate-200">
            {blocks.map((para, i) => {
                const key = normalizeTextBlock(para);
                const match = highlightNorms && key && highlightNorms.has(key);
                return (
                    <p
                        key={i}
                        className={`whitespace-pre-wrap rounded-md px-1 -mx-1 py-0.5 ${
                            match ? 'bg-amber-100/90 dark:bg-amber-900/35' : ''
                        }`}
                    >
                        {para}
                    </p>
                );
            })}
        </div>
    );
}
