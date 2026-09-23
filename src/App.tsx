import { useEffect, useMemo, useRef, useState } from "react";
import {
    countHits,
} from "./core/lotofacil";
import historicoCompleto from "./data/lotofacil-history.json";
import type { ConcursoLotofacil, ResumoHistoricoLotofacil } from "./history/types";
import {
    createLotofacilHistoryProvider,
    type LotofacilHistoryProvider,
} from "./history/lotofacilHistoryProvider";
import {
    LOTOFACIL_GENERATOR_CONFIG,
    useLotofacilGenerator,
} from "./hooks/useLotofacilGenerator";
import { useLotofacilEvaluation } from "./hooks/useLotofacilEvaluation";
import heroBalls from "./assets/lottolab-hero-balls-transparent.png";
import "./App.css";

const RESULTADOS_POR_PAGINA = 100;
const EMBEDDED_DATA = historicoCompleto;

const filtros = [
    {
        id: "pares",
        nome: "Pares",
        valores: Array.from({ length: 11 }, (_, i) => i + 2),
    },
    {
        id: "repetidas",
        nome: "Repetidas",
        valores: Array.from({ length: 11 }, (_, i) => i + 5),
    },
    {
        id: "moldura",
        nome: "Moldura",
        valores: Array.from({ length: 10 }, (_, i) => i + 6),
    },
    {
        id: "primos",
        nome: "Primos",
        valores: Array.from({ length: 10 }, (_, i) => i),
    },
    {
        id: "fibonacci",
        nome: "Fibonacci",
        valores: Array.from({ length: 8 }, (_, i) => i),
    },
    {
        id: "multiplos3",
        nome: "Múltiplos de 3",
        valores: Array.from({ length: 9 }, (_, i) => i),
    },
];

function Icon({ name, size = 20 }: { name: string; size?: number }) {
    const paths: Record<string, string> = {
        check: "M5 12l4 4L19 6", chevron: "m7 10 5 5 5-5", trash: "M5 7h14M9 7V4h6v3M8 7l1 13h6l1-13",
        ticketCheck: "M4 7a2 2 0 0 0 2-2h12v4a3 3 0 0 0 0 6v4H6a2 2 0 0 0-2-2V7Zm5 5 2 2 4-4",
        help: "M9.5 9a2.5 2.5 0 1 1 3 2.4c-.5.3-.5.9-.5 1.6M12 17h.01",
        settings: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3M12 19v3M2 12h3M19 12h3",
        grid: "M4 4h3v3H4zM10.5 4h3v3h-3zM17 4h3v3h-3zM4 10.5h3v3H4zM10.5 10.5h3v3h-3zM17 10.5h3v3h-3zM4 17h3v3H4zM10.5 17h3v3h-3zM17 17h3v3h-3z",
        filter: "M4 5h16l-6 7v6l-4 2v-8z", lock: "M6 10h12v10H6zM9 10V7a3 3 0 0 1 6 0v3",
        sparkle: "M12 3c1 5 3 7 8 8-5 1-7 3-8 8-1-5-3-7-8-8 5-1 7-3 8-8",
        arrowLeft: "m15 18-6-6 6-6", arrowRight: "m9 18 6-6-6-6",
        refresh: "M20 11a8.1 8.1 0 0 0-15.5-2M4 5v4h4M4 13a8.1 8.1 0 0 0 15.5 2M20 19v-4h-4"
    };
    return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name] ?? paths.sparkle} /></svg>;
}
function App() {
    const modalidade = "lotofacil" as const;
    const definition = LOTOFACIL_GENERATOR_CONFIG.definition;
    const dezenas = LOTOFACIL_GENERATOR_CONFIG.numbers;
    const [historico, setHistorico] = useState<ResumoHistoricoLotofacil | null>(null);
    const [concursoReferencia, setConcursoReferencia] = useState<number | null>(null);
    const historicoProvider = useRef<LotofacilHistoryProvider>(createLotofacilHistoryProvider());
    const referenciasSalvas = useRef<Partial<Record<"lotofacil", number>>>({});
    const [detalhesAbertos, setDetalhesAbertos] = useState<Record<string, boolean>>({});
    const [exportando, setExportando] = useState(false);
    const [mensagemExportacao, setMensagemExportacao] = useState<string | null>(null);
    const [atualizandoConcursos, setAtualizandoConcursos] = useState(false);
    const [mensagemHistorico, setMensagemHistorico] = useState<string | null>(null);
    const timeoutMensagemHistorico = useRef<number | null>(null);

    const concursosDisponiveis = useMemo(() => {
        const concursos = new Map<number, ConcursoLotofacil>();

        for (const concurso of EMBEDDED_DATA as ConcursoLotofacil[]) {
            concursos.set(concurso.concurso, concurso);
        }

        for (const concurso of historico?.concursos ?? []) {
            concursos.set(concurso.concurso, concurso);
        }

        if (historico?.concursoAnterior) {
            concursos.set(
                historico.concursoAnterior.concurso,
                historico.concursoAnterior,
            );
        }

        if (historico?.concursoAtual) {
            concursos.set(historico.concursoAtual.concurso, historico.concursoAtual);
        }

        return [...concursos.values()].sort((a, b) => a.concurso - b.concurso);
    }, [historico, modalidade]);

    const indiceConcursoReferencia = concursosDisponiveis.findIndex(
        (concurso) => concurso.concurso === concursoReferencia,
    );
    const concursoSelecionado =
        concursosDisponiveis[indiceConcursoReferencia] ?? null;

    const {
        modoSelecao,
        setModoSelecao,
        fixas,
        setFixas,
        excluidas,
        setExcluidas,
        quantidades,
        selecionados,
        somaMinima,
        setSomaMinima,
        somaMaxima,
        setSomaMaxima,
        jogos,
        gerando,
        errosGeracao,
        resultadosVisiveis,
        setResultadosVisiveis,
        alternarFixa,
        alternarExcluida,
        alternarQuantidade,
        alternarFiltro,
        limpar,
        gerarJogos,
        cacheAvaliacoes,
    } = useLotofacilGenerator({ concursoSelecionado });

    const { jogosAvaliados, avaliando } = useLotofacilEvaluation({
        jogos,
        concursosDisponiveis,
        cacheAvaliacoes: cacheAvaliacoes.current,
    });

    useEffect(() => {
        let ativo = true;

        void historicoProvider.current.carregar().then((resumo) => {
            if (ativo) setHistorico(resumo);
        }).catch(() => {
            if (!ativo) return;
            setHistorico(null);
        });

        return () => {
            ativo = false;
        };
    }, [modalidade]);
    useEffect(() => () => {
        if (timeoutMensagemHistorico.current !== null) {
            window.clearTimeout(timeoutMensagemHistorico.current);
        }
    }, []);
    useEffect(() => {
        if (concursoReferencia !== null || historico === null) return;

        const concursoInicial =
            historico?.concursoAtual?.concurso ??
            concursosDisponiveis.at(-1)?.concurso ??
            null;

        if (concursoInicial !== null) {
            setConcursoReferencia(referenciasSalvas.current[modalidade] ?? concursoInicial);
        }
    }, [concursoReferencia, historico, concursosDisponiveis, modalidade]);

    function navegarConcurso(direcao: -1 | 1) {
        if (indiceConcursoReferencia < 0) return;

        const proximoIndice = indiceConcursoReferencia + direcao;
        const proximoConcurso = concursosDisponiveis[proximoIndice];

        if (proximoConcurso) {
            setConcursoReferencia(proximoConcurso.concurso);
            referenciasSalvas.current[modalidade] = proximoConcurso.concurso;
        }
    }

    async function exportarJogos() {
        if (!window.lotofacilPdf || jogosAvaliados.length === 0) return;

        setExportando(true);
        setMensagemExportacao(null);
        try {
            const resultado = await window.lotofacilPdf.exportar(
                jogosAvaliados.map(({ id, jogo }) => ({
                    id,
                    dezenas: jogo.dezenas,
                    quantidade: jogo.quantidade,
                    pares: jogo.pares,
                    soma: jogo.soma,
                    repetidas: concursoSelecionado ? countHits(jogo, concursoSelecionado) : 0,
                })),
            );
            if (resultado.saved) setMensagemExportacao("PDF salvo com sucesso.");
        } catch {
            setMensagemExportacao("Não foi possível exportar o PDF.");
        } finally {
            setExportando(false);
        }
    }

    async function atualizarConcursos() {
        setAtualizandoConcursos(true);
        setMensagemHistorico(null);
        if (timeoutMensagemHistorico.current !== null) {
            window.clearTimeout(timeoutMensagemHistorico.current);
        }
        try {
            const resumo = await historicoProvider.current.refresh();
            setHistorico(resumo);
            const dataHora = new Intl.DateTimeFormat("pt-BR", {
                dateStyle: "short",
                timeStyle: "short",
            }).format(new Date());
            let mensagem: string;

            if (resumo.erroAtualizacao) {
                mensagem = `Não foi possível atualizar: ${resumo.erroAtualizacao}`;
            } else if (resumo.concursosAdicionados > 0 && resumo.concursoAtual) {
                const quantidade = resumo.concursosAdicionados;
                mensagem = `${quantidade} concurso${quantidade === 1 ? "" : "s"} novo${quantidade === 1 ? "" : "s"} adicionado${quantidade === 1 ? "" : "s"}. Histórico atualizado até o concurso ${resumo.concursoAtual.concurso} em ${dataHora}.`;
            } else if (resumo.concursoAtual) {
                mensagem = `Histórico já está atualizado até o concurso ${resumo.concursoAtual.concurso} em ${dataHora}.`;
            } else {
                mensagem = "Não há concursos disponíveis no histórico.";
            }
            setMensagemHistorico(mensagem);
        } catch {
            setMensagemHistorico("Não foi possível atualizar os concursos. O histórico atual foi mantido.");
        } finally {
            setAtualizandoConcursos(false);
            timeoutMensagemHistorico.current = window.setTimeout(() => {
                setMensagemHistorico(null);
                timeoutMensagemHistorico.current = null;
            }, 5000);
        }
    }


    return (
        <div className={"app modality-" + modalidade}>
            <section className="hero-landing" aria-label="LottoLab banner">
                <div className="hero-brand-wrap">
                    <div className="brand-copy">
                        <h1 className="brand"><span>Lotto</span><span>Lab</span></h1>
                        <p className="hero-title">Monte seus jogos com estratégia</p>
                        <p className="hero-description">Escolha suas dezenas, defina os critérios e gere seus jogos.</p>
                        <div className="hero-divider" />
                        <div className="hero-tags">ANÁLISE • ESTRATÉGIA • MAIS POSSIBILIDADES</div>
                    </div>
                </div>

                <div className="hero-visual" aria-hidden="true">
                    <img src={heroBalls} alt="" />
                </div>

                <div className="hero-slogan" aria-hidden="true">
                    Mais<br />
                    que números,<br />
                    estratégia!
                </div>
            </section>

            <main className="content">

                <div className="main-grid">
                    <section className="card fixed-card selection-card">
                        <div className="selection-heading">
                            <div className="title-icon"><Icon name="grid" /></div>
                            <div><h2>Seleção de dezenas</h2><p>Toque em uma dezena para selecionar.</p></div>
                        </div>
                        <div className="selection-toolbar">
                            <div className="selection-modes" role="group" aria-label="Modo de seleção">
                                <button type="button" className={modoSelecao === "fixa" ? "active" : ""} aria-pressed={modoSelecao === "fixa"} onClick={() => setModoSelecao("fixa")}>Fixa</button>
                                <button type="button" className={modoSelecao === "excluida" ? "active avoid-mode" : "avoid-mode"} aria-pressed={modoSelecao === "excluida"} onClick={() => setModoSelecao("excluida")}>Evitar</button>
                                <button type="button" className="selection-mode-clear" onClick={() => { setFixas([]); setExcluidas([]); }}><Icon name="trash" size={14} />Limpar</button>
                            </div>

                        </div>
                        <div className="number-grid">
                            {dezenas.map((numero) => {
                                const fixa = fixas.includes(numero);
                                const excluida = excluidas.includes(numero);
                                return (
                                    <button key={numero} type="button" aria-pressed={fixa || excluida}
                                        aria-label={`${String(numero).padStart(2, "0")}${fixa ? ", fixa" : excluida ? ", a evitar" : ""}`}
                                        className={`number-button ${fixa ? "selected" : ""} ${excluida ? "avoid excluded" : ""}`}
                                        onClick={() => modoSelecao === "fixa" ? alternarFixa(numero) : alternarExcluida(numero)}>
                                        {String(numero).padStart(2, "0")}{excluida && <span className="exclude-mark" aria-hidden="true">x</span>}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="previous-contest">
                            {concursoSelecionado ? (<>
                                <div className="selection-heading drawn-numbers-heading">
                                    <div className="title-icon"><Icon name="ticketCheck" /></div>
                                    <div>
                                        <h2>Dezenas sorteadas</h2>
                                        <p>Confira as dezenas do concurso selecionado.</p>
                                    </div>
                                </div>
                                <div className="contest-navigation">
                                    <span className="contest-label">Concurso</span>
                                    <button type="button" className="contest-arrow" aria-label="Concurso anterior" disabled={indiceConcursoReferencia <= 0} onClick={() => navegarConcurso(-1)}><Icon name="arrowLeft" size={16} /></button>
                                    <strong>{concursoSelecionado.concurso}</strong>
                                    <button type="button" className="contest-arrow" aria-label="Próximo concurso" disabled={indiceConcursoReferencia < 0 || indiceConcursoReferencia === concursosDisponiveis.length - 1} onClick={() => navegarConcurso(1)}><Icon name="arrowRight" size={16} /></button>
                                    <button type="button" className="contest-refresh-button" aria-label="Atualizar concursos" title="Atualizar concursos" onClick={atualizarConcursos} disabled={atualizandoConcursos}>
                                        <Icon name="refresh" size={15} />
                                    </button>
                                </div>
                                {mensagemHistorico && <p className="history-update-status" role="status">{mensagemHistorico}</p>}
                                <div className="previous-numbers">{concursoSelecionado.dezenas.map((dezena) => <span key={dezena}>{String(dezena).padStart(2, "0")}</span>)}</div>
                            </>) : <span className="history-loading">Carregando histórico...</span>}
                        </div>
                    </section>
                    <div className="right-column">
                        <section className="card filters-card">
                            <div className="card-header">
                                <div className="title-group">
                                    <div className="title-icon"><Icon name="filter" /></div>
                                    <div><h2>Critérios e filtros</h2><p>Defina os parâmetros para gerar seus jogos.</p></div>
                                </div>
                            </div>

                            <div className="filters-grid unified-filters-grid">
                                <div className="filter-box filter-section quantity-filter-box">
                                    <div className="filter-heading"><Icon name="sparkle" size={17} />Quantidade de dezenas</div>
                                    <div className="options">
                                        {definition.allowedBetSizes.map((valor) => (
                                            <button key={valor} type="button" aria-pressed={quantidades.includes(valor)} className={"option-button " + (quantidades.includes(valor) ? "active" : "")} onClick={() => alternarQuantidade(valor)}>{valor}</button>
                                        ))}
                                    </div>
                                </div>

                                {["pares", "repetidas", "moldura", "primos", "multiplos3", "fibonacci"].map((id) => {
                                    const filtro = filtros.find((item) => item.id === id)!;
                                    const valoresSelecionados = selecionados[id] ?? [];
                                    return (
                                        <div className={`filter-box filter-section discrete-filter filter-${id}`} key={id}>
                                            <div className="filter-heading"><Icon name="sparkle" size={17} />{filtro.nome}</div>
                                            <div className="options">
                                                {filtro.valores.map((valor) => (
                                                    <button key={valor} type="button" aria-pressed={valoresSelecionados.includes(valor)} className={"option-button " + (valoresSelecionados.includes(valor) ? "active" : "")} onClick={() => alternarFiltro(id, valor)}>{valor}</button>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}

                                <div className="filter-box filter-section sum-actions-section">
                                    <div className="filter-heading"><Icon name="sparkle" size={17} />Soma das dezenas (Min x Max)</div>
                                    <div className="sum-fields compact-sum-fields">
                                        <div><input id="soma-minima" aria-label="Soma mínima" type="number" min={120} max={270} value={somaMinima} onChange={(event) => setSomaMinima(Number(event.target.value))} /></div>
                                        <span>até</span>
                                        <div><input id="soma-maxima" aria-label="Soma máxima" type="number" min={120} max={270} value={somaMaxima} onChange={(event) => setSomaMaxima(Number(event.target.value))} /></div>
                                    </div>

                                </div>
                            </div>
                            <div className="filters-footer-actions">
                                <button type="button" className="clear-button" onClick={limpar}><Icon name="trash" size={17} />Limpar tudo</button>
                                <button type="button" className="generate-button" onClick={gerarJogos} disabled={gerando}><Icon name="sparkle" size={20} />{gerando ? "Gerando..." : "Gerar jogos"}</button>
                            </div>                        </section>
                    </div>
                </div>

                <section className="card results-card">
                    <div className="card-header">
                        <div className="title-group">
                            <div className="title-icon"><Icon name="filter" /></div>

                            <div>
                                <h2>Jogos gerados</h2>
                                <p>
                                    Os jogos compatíveis com os critérios aparecerão aqui.
                                </p>
                            </div>
                        </div>

                        <div className="results-actions">
                            {jogos.length > 0 && (
                                <div className="results-count">
                                    <strong>{jogos.length.toLocaleString("pt-BR")}</strong>
                                    Combinações encontradas
                                </div>
                            )}
                            <button
                                type="button"
                                className="export-button"
                                onClick={() => void exportarJogos()}
                                disabled={jogosAvaliados.length === 0 || exportando}
                            >
                                {exportando ? "Exportando..." : "Exportar"}
                            </button>
                        </div>
                    </div>
                    {mensagemExportacao && <p className="export-status" role="status">{mensagemExportacao}</p>}

                    {gerando || avaliando ? (
                        <div className="empty-state">
                            <div className="empty-icon"><Icon name="sparkle" size={28} /></div>
                            <h3>{gerando ? "Gerando combinações..." : "Analisando histórico..."}</h3>
                            <p>{gerando
                                ? "A busca está aplicando todos os critérios selecionados."
                                : "Os jogos estão sendo comparados com a base histórica."}</p>
                        </div>
                    ) : errosGeracao.length > 0 ? (
                        <div className="empty-state validation-error">
                            <div className="empty-icon">!</div>
                            <h3>Não foi possível gerar jogos com essa configuração.</h3>
                            <div className="validation-issues">
                                {errosGeracao.map((erro) => (
                                    <div className="validation-issue" key={erro.code}>
                                        <strong>{erro.title}</strong>
                                        <span>{erro.message}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : jogos.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-icon"><Icon name="sparkle" size={28} /></div>
                            <h3>Nenhum jogo gerado</h3>
                            <p>
                                Configure os critérios acima e clique em{" "}
                                <strong>Gerar jogos</strong>.
                            </p>
                        </div>
                    ) : (
                        <div className="generated-results">
                            <div className="games-list">
                                {jogosAvaliados.slice(0, resultadosVisiveis).map((resultado) => {
                                    const jogo = resultado.jogo;
                                    const repetidasReferencia = concursoSelecionado
                                        ? countHits(jogo, concursoSelecionado)
                                        : 0;
                                    const detalhesAberto = Boolean(detalhesAbertos[resultado.id]);

                                    return (
                                        <article className="game-row" key={resultado.id}>
                                            <div className="game-header">
                                                <div className="game-title">
                                                    <strong>{resultado.id.replace("jogo-", "Jogo ")}</strong>
                                                    <button
                                                        type="button"
                                                        className="game-details-button"
                                                        onClick={() =>
                                                            setDetalhesAbertos((atual) => ({
                                                                ...atual,
                                                                [resultado.id]: !atual[resultado.id],
                                                            }))
                                                        }
                                                    >
                                                        {detalhesAberto ? "Fechar" : "Detalhes"}
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="game-numbers">
                                                {jogo.dezenas.map((dezena) => (
                                                    <span key={dezena}>
                                                        {String(dezena).padStart(2, "0")}
                                                    </span>
                                                ))}
                                            </div>

                                            <div className="game-metrics">
                                                <span>{jogo.quantidade} dezenas</span>
                                                <span>{jogo.pares} pares</span>
                                                <span>Soma {jogo.soma}</span>
                                                <strong className="metric-highlight">
                                                    Repetidas {repetidasReferencia}
                                                </strong>
                                            </div>

                                            {detalhesAberto && (
                                                <div className="game-details">
                                                    <div className="detail-item">
                                                        <span>Média histórica</span>
                                                        <strong>
                                                            {resultado.avaliacao.media.toLocaleString(
                                                                "pt-BR",
                                                                {
                                                                    minimumFractionDigits: 2,
                                                                    maximumFractionDigits: 2,
                                                                },
                                                            )}
                                                        </strong>
                                                    </div>

                                                    <div className="detail-item">
                                                        <span>Melhor histórico</span>
                                                        <strong>{resultado.avaliacao.melhor} acertos</strong>
                                                    </div>

                                                    <div className="detail-item">
                                                        <span>Recência</span>
                                                        <strong>
                                                            {resultado.avaliacao.pontuacao.recencia.toLocaleString(
                                                                "pt-BR",
                                                                {
                                                                    minimumFractionDigits: 1,
                                                                    maximumFractionDigits: 1,
                                                                },
                                                            )}
                                                        </strong>
                                                    </div>

                                                    <div className="detail-item">
                                                        <span>Consistência</span>
                                                        <strong>
                                                            {resultado.avaliacao.pontuacao.consistencia.toLocaleString(
                                                                "pt-BR",
                                                                {
                                                                    minimumFractionDigits: 1,
                                                                    maximumFractionDigits: 1,
                                                                },
                                                            )}
                                                        </strong>
                                                    </div>

                                                    <div className="detail-item">
                                                        <span>Desempenho alto</span>
                                                        <strong>
                                                            {resultado.avaliacao.pontuacao.desempenhoAlto.toLocaleString(
                                                                "pt-BR",
                                                                {
                                                                    minimumFractionDigits: 1,
                                                                    maximumFractionDigits: 1,
                                                                },
                                                            )}
                                                        </strong>
                                                    </div>

                                                    <div className="detail-item">
                                                        <span>Primos</span>
                                                        <strong>{jogo.primos}</strong>
                                                    </div>

                                                    <div className="detail-item">
                                                        <span>Fibonacci</span>
                                                        <strong>{jogo.fibonacci}</strong>
                                                    </div>

                                                    <div className="detail-item">
                                                        <span>Múltiplos de 3</span>
                                                        <strong>{jogo.multiplos3}</strong>
                                                    </div>

                                                    <div className="detail-item">
                                                        <span>Moldura</span>
                                                        <strong>{jogo.moldura}</strong>
                                                    </div>
                                                </div>
                                            )}
                                        </article>
                                    );
                                })}
                            </div>
                            {resultadosVisiveis < jogosAvaliados.length && (
                                <button
                                    type="button"
                                    className="show-more-button"
                                    onClick={() =>
                                        setResultadosVisiveis((quantidade) =>
                                            quantidade + RESULTADOS_POR_PAGINA,
                                        )
                                    }
                                >
                                    Mostrar mais jogos
                                </button>
                            )}
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}

export default App;













