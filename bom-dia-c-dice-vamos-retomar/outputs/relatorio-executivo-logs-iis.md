# Relatório executivo de logs IIS

Arquivo analisado: `/Users/lucassantana/Downloads/u_ex260528_x.log`

Período coberto: `2026-05-27 23:59:56Z` a `2026-05-28 06:26:45Z`

## Sumário executivo

O ambiente processou **428.142 requisições** em aproximadamente **6h27**, com **média global de 900 ms**, **p95 de 4,05 s** e **p99 de 9,36 s**. O volume é majoritariamente SOAP, concentrado em poucas funções.

Os principais pontos de atenção são:

1. **Volume excessivo de WSDL/metadados**: foram identificadas **179.285 requisições com query de WSDL/XSD**, aproximadamente **41,9% do volume total**. Além disso, há **201.650 POSTs com query `wsdl`**, o que sugere clientes chamando operação SOAP com URL de metadados ou padrão de integração incorreto.
2. **Endpoint de health/rastreabilidade quebrado em `/worklab`**: **9.036 requisições 404** para `/worklab/drvRastreabilidadePedido/valida/v1.0/check/true`. O mesmo check em `/dbsync/...` responde 200.
3. **Cauda longa severa em envio/consulta de laudos**: `EnviaLaudoAtendimentoLista` teve **p99 de 30,2 s** e máximo de **365,6 s**. `BuscaResultadosPorPeriodo` teve **p95 de 38,0 s**, **p99 de 100,0 s** e máximo de **203,6 s**.
4. **Concentração de carga em um cliente interno**: `10.225.14.8` gerou **401.200 requisições**, cerca de **93,7%** do total.
5. **Sinais de conexão abortada/client reset**: há ocorrências com `win32-status 64`, incluindo requisições longas. Isso costuma indicar conexão encerrada pelo cliente ou intermediário antes do término.
6. **Clientes legados e variados**: alto volume de `Borland SOAP`, `CodeGear SOAP`, `.NET Web Services`, `SOAP Toolkit`, Java antigo, PHP SOAP e chamadas sem User-Agent. Isso aumenta risco operacional de comportamento inconsistente, retry agressivo e baixo reaproveitamento de metadados.

## Indicadores globais

| Métrica | Valor |
|---|---:|
| Requisições analisadas | 428.142 |
| POST | 376.798 |
| GET | 51.344 |
| HTTP 200 | 410.046 |
| HTTP 404 | 9.036 |
| Status 0 / incompleto | ~9 mil a 10,8 mil, conforme parsing de linhas incompletas |
| Média global | 900 ms |
| p50 global | 163 ms |
| p90 global | 2.339 ms |
| p95 global | 4.054 ms |
| p99 global | 9.357 ms |
| Máximo global | 365.605 ms |
| Requisições >= 1s | 86.107 |
| Requisições >= 5s | 14.160 |
| Requisições >= 10s | 3.840 |
| Tempo acumulado de processamento | ~6.425 minutos |

Observação: o log não contém campos de bytes enviados/recebidos (`sc-bytes`, `cs-bytes`). Portanto, “volume de dados processados” aqui está expresso como **quantidade de requisições** e **tempo total de processamento**, não tamanho de payload.

## Volume por função SOAP

| Função | Volume | % total | Avg | p95 | p99 | Máx | >=5s |
|---|---:|---:|---:|---:|---:|---:|---:|
| ConsultaStatusAtendimento | 166.167 | 38,8% | 495 ms | 2.492 ms | 6.146 ms | 24.827 ms | 2.667 |
| BuscaPendenciasMPP | 42.820 | 10,0% | 651 ms | 3.409 ms | 6.275 ms | 21.184 ms | 804 |
| EnviaLaudoAtendimentoLista | 38.550 | 9,0% | 2.223 ms | 7.977 ms | 30.246 ms | 365.605 ms | 3.106 |
| EnviaLaudoAtendimento | 33.435 | 7,8% | 1.578 ms | 6.244 ms | 15.153 ms | 91.097 ms | 2.368 |
| EnviaLoteResultados | 32.344 | 7,6% | 960 ms | 4.294 ms | 9.023 ms | 67.344 ms | 1.198 |
| EnviaResultadoBase64 | 19.325 | 4,5% | 941 ms | 4.400 ms | 8.231 ms | 32.591 ms | 765 |
| EnviaLoteResultadosV3 | 15.824 | 3,7% | 613 ms | 3.240 ms | 6.177 ms | 42.165 ms | 284 |
| RecebeAtendimento | 11.904 | 2,8% | 2.301 ms | 6.670 ms | 10.760 ms | 23.365 ms | 1.167 |
| EnviaLaudoAtendimentoV3 | 9.654 | 2,3% | 1.664 ms | 6.605 ms | 16.769 ms | 79.584 ms | 768 |
| EnviaLaudoAtendimentoListaV3 | 5.158 | 1,2% | 1.877 ms | 6.598 ms | 18.113 ms | 88.589 ms | 432 |
| BuscaResultadosPorPeriodo | 570 | 0,1% | 8.497 ms | 38.046 ms | 99.994 ms | 203.564 ms | 184 |
| BuscaProcedimentos | 307 | 0,1% | 8.649 ms | 32.175 ms | 47.566 ms | 61.660 ms | 114 |

## Maiores consumidores de capacidade

Tempo acumulado estimado por função:

| Função | Tempo acumulado | Volume | Avg | p95 | >=5s |
|---|---:|---:|---:|---:|---:|
| EnviaLaudoAtendimentoLista | ~1.429 min | 38.550 | 2.223 ms | 7.977 ms | 3.106 |
| ConsultaStatusAtendimento | ~1.370 min | 166.167 | 495 ms | 2.492 ms | 2.667 |
| EnviaLaudoAtendimento | ~879 min | 33.435 | 1.578 ms | 6.244 ms | 2.368 |
| EnviaLoteResultados | ~517 min | 32.344 | 960 ms | 4.294 ms | 1.198 |
| BuscaPendenciasMPP | ~465 min | 42.820 | 651 ms | 3.409 ms | 804 |
| RecebeAtendimento | ~456 min | 11.904 | 2.301 ms | 6.670 ms | 1.167 |
| EnviaResultadoBase64 | ~303 min | 19.325 | 941 ms | 4.400 ms | 765 |

Leitura executiva: **EnviaLaudoAtendimentoLista** não é o maior volume, mas é o maior consumidor de capacidade. Otimizar essa função provavelmente gera o maior ganho sistêmico.

## Eventos lentos críticos

Top ocorrências:

| Timestamp UTC | Função | Cliente/UA | Tempo | Status |
|---|---|---|---:|---|
| 2026-05-28 01:40:57 | EnviaLaudoAtendimentoLista | PHP-SOAP/7.2.19 | 365,6 s | 200 / win32 64 |
| 2026-05-28 00:36:44 | EnviaLaudoAtendimentoLista | PHP-SOAP/7.2.19 | 268,5 s | 200 |
| 2026-05-28 01:41:22 | EnviaLaudoAtendimentoLista | Apache HttpClient Java 1.7 | 253,2 s | 200 |
| 2026-05-28 01:38:36 | EnviaLaudoAtendimentoLista | WinHTTP | 250,7 s | 200 |
| 2026-05-28 01:27:56 | EnviaLaudoAtendimentoLista | PHP-SOAP/7.2.19 | 211,9 s | 200 |
| 2026-05-28 02:04:43 | BuscaResultadosPorPeriodo | sem User-Agent | 203,6 s | 200 |
| 2026-05-28 01:39:52 | BuscaResultadosPorPeriodo | CodeGear SOAP | 202,7 s | 200 |

Ponto de atenção: várias lentidões extremas concentram-se entre **00:35 e 01:42 UTC**, sugerindo janela de saturação, lote pesado, lock em banco, processo de integração paralelo ou gargalo em dependência externa.

## Erros e falhas

### 404 recorrente

Único endpoint com erro HTTP relevante:

| Endpoint | Volume | Status |
|---|---:|---|
| GET `/worklab/drvRastreabilidadePedido/valida/v1.0/check/true` | 9.036 | 404.0.2 |

O mesmo padrão em `/dbsync/drvRastreabilidadePedido/valida/v1.0/check/true` responde 200, com **8.871 chamadas**, mas p95 de **2,1 s** e máximo de **33,7 s**.

Hipótese: health check, balanceador, monitoramento ou cliente de rastreabilidade apontando para o virtual directory errado (`/worklab` em vez de `/dbsync`).

### Status 0 e win32-status 64

Foram observados milhares de eventos `GET /` com status 0 a partir de `10.225.14.6` e `10.225.14.7`, sem User-Agent. Também há eventos `win32-status 64` em SOAP.

Leitura provável:

- `GET /` com status 0: probe/load balancer/monitoramento fechando conexão ou rota raiz sem resposta HTTP normal.
- `win32-status 64`: conexão abortada pelo cliente/intermediário. Em requisições longas, pode ser timeout do consumidor antes do servidor concluir.

## Volume técnico indesejado: WSDL/XSD

Requisições de metadados identificadas:

| Recurso | Volume |
|---|---:|
| `/dbsync/wsrvProtocoloDBSync.dbsync.svc?wsdl` | 168.845 |
| `/dbsync/wsrvProtocoloDBSync.dbsync.svc?xsd=xsd0` | 5.501 |
| `/dbsync/wsrvProtocoloDBSync.dbsync.svc?wsdl=wsdl0` | 1.684 |
| `/dbsync/wsrvProtocoloDBSync.dbsync.svc?wsdl=wsdl1` | 1.654 |
| `/dbsync/wsrvProtocoloDBSync.dbsync.svc?singleWsdl` | 1.585 |

Além disso, há **201.650 POSTs com query `wsdl`**, principalmente:

| Função | POSTs com query `wsdl` |
|---|---:|
| ConsultaStatusAtendimento | 93.433 |
| EnviaLaudoAtendimentoLista | 36.738 |
| BuscaPendenciasMPP | 25.073 |
| EnviaLoteResultados | 14.280 |
| EnviaLoteResultadosV3 | 12.333 |
| EnviaResultadoBase64 | 8.048 |

Isso é um forte candidato a melhoria: clientes deveriam cachear WSDL ou chamar endpoint operacional sem query de metadados.

## Picos de carga

Maior minuto:

| Minuto UTC | Requisições |
|---|---:|
| 2026-05-28 03:02 | 2.470 |
| 2026-05-28 03:17 | 2.450 |
| 2026-05-28 04:16 | 2.300 |
| 2026-05-28 03:07 | 2.244 |
| 2026-05-28 03:04 | 2.227 |

Volume por hora:

| Hora UTC | Requisições |
|---|---:|
| 00h | 52.962 |
| 01h | 54.561 |
| 02h | 50.465 |
| 03h | 87.670 |
| 04h | 81.759 |
| 05h | 72.567 |
| 06h parcial | 28.086 |

Interpretação: há aumento de carga relevante a partir de **03h UTC**, mas as maiores latências extremas ocorreram antes, entre **00h35 e 01h42 UTC**. Isso sugere que a lentidão não é apenas volume bruto; pode haver consultas específicas, payloads grandes, locks, batches ou dependência externa.

## Clientes e integração

| Cliente IP | Volume | Leitura |
|---|---:|---|
| 10.225.14.8 | 401.200 | Principal consumidor, concentra tráfego SOAP real |
| 10.225.14.7 | 13.472 | Provável monitoramento/probe |
| 10.225.14.6 | 13.470 | Provável monitoramento/probe |

User-Agents mais comuns:

| Família | Volume |
|---|---:|
| Borland SOAP | 135.725 |
| Sem User-Agent | 130.174 |
| Mozilla/legacy | 57.188 |
| CodeGear SOAP | 26.378 |
| SOAP Toolkit | 10.221 |
| NuSOAP | 9.484 |
| Apache HttpClient | 9.478 |
| Java | 9.390 |
| Apache CXF | 7.952 |
| Zabbix | 5.097 |

Ponto de atenção: há muita tecnologia cliente antiga ou heterogênea. Isso tende a gerar chamadas repetidas a WSDL, timeouts diferentes, retries agressivos e uso pouco eficiente de conexão.

## Recomendações priorizadas

### P0 - Corrigir ruído/erro operacional

1. Corrigir o endpoint `/worklab/drvRastreabilidadePedido/valida/v1.0/check/true`, ou ajustar o monitor/balanceador para `/dbsync/...`.
2. Separar health check real de endpoint de negócio. Ideal: endpoint leve tipo `/health` ou `/dbsync/health`, sem dependência pesada.
3. Investigar os `GET /` status 0 de `10.225.14.6` e `10.225.14.7`: parecem probes sem rota adequada.

### P1 - Reduzir desperdício de WSDL/metadados

1. Orientar clientes a cachear WSDL/XSD.
2. Revisar clientes que fazem POST com query `wsdl`.
3. Considerar servir WSDL com cache headers agressivos.
4. Se possível, separar endpoint de metadados do endpoint operacional.
5. Monitorar `?wsdl` como métrica própria, com alerta quando passar de um limiar.

### P1 - Atacar gargalos de performance

1. Priorizar `EnviaLaudoAtendimentoLista`: maior consumidor de tempo total e pior máximo.
2. Investigar `BuscaResultadosPorPeriodo` e `BuscaResultadosPorPeriodoV3`: baixo volume, mas p95/p99 críticos.
3. Para funções de busca por período:
   - limitar janela máxima;
   - exigir paginação;
   - validar índices por filtros de data/cliente/status;
   - evitar retorno massivo em uma única resposta.
4. Para envio de laudos/listas:
   - medir tamanho médio de payload;
   - instrumentar tempo de banco, serialização XML, transformação/base64 e chamada externa;
   - avaliar processamento assíncrono com protocolo de status.

### P2 - Melhorar observabilidade

1. Incluir `cs-bytes` e `sc-bytes` no log IIS para medir payload.
2. Logar correlation-id por requisição.
3. Logar identificador de cliente/sistema integrador.
4. Logar tamanho do lote, quantidade de exames/laudos e período consultado.
5. Criar dashboards por:
   - função SOAP;
   - cliente;
   - p95/p99;
   - timeouts/client resets;
   - WSDL volume;
   - erros 4xx/5xx/status 0.

### P2 - Governança de clientes

1. Mapear quais clientes usam Borland/CodeGear/SOAP Toolkit/PHP antigo.
2. Definir política de timeout e retry padronizada.
3. Reduzir chamadas de polling em `ConsultaStatusAtendimento`, que representa **38,8%** de todo o volume.
4. Avaliar mecanismos de push/webhook ou backoff exponencial para reduzir polling.

## Hipóteses que valem validação

1. `EnviaLaudoAtendimentoLista` pode estar processando payloads grandes ou listas sem limite.
2. `BuscaResultadosPorPeriodo` pode estar sofrendo com consulta por período amplo, ausência de índice ou retorno massivo.
3. Os clientes podem estar baixando WSDL ou chamando operações com `?wsdl` em cada transação.
4. Probes de infraestrutura estão mal configurados e geram ruído em `/` e `/worklab`.
5. Alguns timeouts podem estar no cliente/load balancer, não necessariamente no IIS, por causa de `win32-status 64`.

## Próximas análises recomendadas

1. Cruzar estes logs com logs de aplicação/banco no intervalo `00:35-01:42 UTC`.
2. Levantar tamanho de payload por endpoint.
3. Separar métricas por cliente lógico, não só IP.
4. Amostrar requests lentas de `BuscaResultadosPorPeriodo` e identificar parâmetros.
5. Verificar configuração de timeout no IIS, balanceador e clientes SOAP.
6. Rodar comparação com outro dia para saber se este padrão é recorrente ou incidente pontual.
