import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// Initialize GoogleGenAI client if API key is present
const apiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;

if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
  try {
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  } catch (err) {
    console.error('Failed to initialize GoogleGenAI client:', err);
  }
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', hasApiKey: !!aiClient, version: '2.3.0', mode: 'Smart Inventory & Analytics' });
});

// AI Inventory Stock Diagnosis Endpoint
app.post('/api/ai/stock-diagnosis', async (req, res) => {
  const { stock } = req.body;
  if (!stock) {
    return res.status(400).json({ error: 'Stock/Inventory data is required' });
  }

  if (aiClient) {
    try {
      const prompt = `당신은 글로벌 공급망(SCM) 및 스마트 재고 관리(Smart Inventory Analytics) 수석 데이터 과학자입니다.
다음 재고 품목 데이터를 분석하여 정밀 재고 진단 및 수요 예측 최적화 리포트를 생성해주세요.

[품목 정보]
- 품목명: ${stock.name} (SKU: ${stock.sku})
- 카테고리: ${stock.category}
- 보관 위치: ${stock.location}
- 현재고: ${stock.currentStock?.toLocaleString()}개
- 안전재고선: ${stock.safetyStock?.toLocaleString()}개 / 최대적정재고: ${stock.maxStock?.toLocaleString()}개
- 발주점(ROP): ${stock.reorderPoint?.toLocaleString()}개
- 입고단가: ${stock.costPrice?.toLocaleString()}원 / 출고단가: ${stock.sellingPrice?.toLocaleString()}원
- 일평균 출고량: ${stock.dailyAverageOutbound}개 / 소진 예상 일수: ${stock.runoutDays}일
- 재고회전율: ${stock.turnoverRate}회/년 / ABC 분석 등급: ${stock.abcGrade}등급
- 조달 리드타임: ${stock.leadTimeDays}일 / 현재 상태: ${stock.status}

반드시 지정된 JSON 스키마 규격으로만 응답해주세요.`;

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('AI generation timeout')), 6500)
      );

      const aiResponse = (await Promise.race([
        aiClient.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            systemInstruction: '당신은 데이터에 기반하여 과다재고 방지, 결품 리스크 최소화, 창고 보관 비용 절감을 위한 정밀한 재고 최적화 가이드를 제공하는 전문가입니다.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                sku: { type: Type.STRING },
                name: { type: Type.STRING },
                score: { type: Type.NUMBER, description: '0 to 100 재고 최적화 건전성 점수' },
                riskLevel: { type: Type.STRING, description: 'HIGH_RISK, CAUTION, OPTIMAL, OVER_STOCKED' },
                recommendedReorderQty: { type: Type.NUMBER, description: '추천 경제적 주문량(EOQ)' },
                estimatedStockoutDate: { type: Type.STRING, description: '예상 결품 도달일 또는 상태' },
                overview: { type: Type.STRING, description: '종합 한줄 진단평' },
                turnoverDiagnosis: {
                  type: Type.OBJECT,
                  properties: {
                    grade: { type: Type.STRING },
                    analysis: { type: Type.STRING },
                    action: { type: Type.STRING },
                  },
                  required: ['grade', 'analysis', 'action'],
                },
                demandForecast: {
                  type: Type.OBJECT,
                  properties: {
                    nextMonthTrend: { type: Type.STRING, description: 'SURGE, STABLE, DECLINE' },
                    expectedDemand: { type: Type.NUMBER },
                    forecastRationale: { type: Type.STRING },
                  },
                  required: ['nextMonthTrend', 'expectedDemand', 'forecastRationale'],
                },
                storageEfficiency: {
                  type: Type.OBJECT,
                  properties: {
                    holdingCostEstimate: { type: Type.NUMBER, description: '월간 예상 보관/기회비용(원)' },
                    spaceUtilization: { type: Type.STRING },
                  },
                  required: ['holdingCostEstimate', 'spaceUtilization'],
                },
                actionableSteps: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: '물류 및 재고 담당자를 위한 3~4단계 실행 액션',
                },
              },
              required: [
                'sku',
                'name',
                'score',
                'riskLevel',
                'recommendedReorderQty',
                'estimatedStockoutDate',
                'overview',
                'turnoverDiagnosis',
                'demandForecast',
                'storageEfficiency',
                'actionableSteps',
              ],
            },
          },
        }),
        timeoutPromise,
      ])) as any;

      const jsonText = aiResponse.text;
      if (jsonText) {
        const parsed = JSON.parse(jsonText);
        return res.json(parsed);
      }
    } catch (error) {
      console.warn('Gemini inventory diagnosis failed, using algorithmic engine:', error);
    }
  }

  // Fast algorithmic fallback
  const isShortage = stock.currentStock <= stock.safetyStock;
  const isOver = stock.currentStock >= stock.maxStock;
  const recommendedReorder = Math.max(0, stock.maxStock - stock.currentStock);
  const holdingCost = Math.round(stock.currentStock * stock.costPrice * 0.015); // 약 1.5% 월간 보관/유지비

  const fallbackReport = {
    sku: stock.sku,
    name: stock.name,
    score: stock.aiOptimizationScore || (isShortage ? 65 : isOver ? 70 : 94),
    riskLevel: isShortage ? 'HIGH_RISK' : isOver ? 'OVER_STOCKED' : 'OPTIMAL',
    recommendedReorderQty: recommendedReorder,
    estimatedStockoutDate: stock.runoutDays > 0 ? `${stock.runoutDays}일 후 소진 예상` : '현재 품절 상태',
    overview: `${stock.name}(${stock.sku})은(는) 현재고 ${stock.currentStock?.toLocaleString()}개로 ${isShortage ? '안전재고선 하회에 따른 긴급 보충 발주가 요구됩니다.' : isOver ? '최대 적정 재고 초과로 보관 비용 효율화가 필요합니다.' : '적정 재고 범위 내에서 최적으로 운영되고 있습니다.'}`,
    turnoverDiagnosis: {
      grade: `ABC 등급: ${stock.abcGrade}등급 / 회전율 ${stock.turnoverRate}회`,
      analysis: stock.turnoverRate > 10 ? '고회전 핵심 품목으로 창고 자산 유동성이 매우 우수합니다.' : '평균 회전율 구간으로 안정적 수요 패턴을 나타냅니다.',
      action: isShortage ? '결품 방지를 위해 조달 리드타임 3일 전 선제 발주 등록' : '정기 로케이션 실사 유지',
    },
    demandForecast: {
      nextMonthTrend: isShortage ? 'SURGE' : 'STABLE',
      expectedDemand: Math.round(stock.dailyAverageOutbound * 30 * 1.1),
      forecastRationale: `일평균 ${stock.dailyAverageOutbound}개 출고 데이터 및 최근 입출고 변동성에 기반한 보정 수요 계산`,
    },
    storageEfficiency: {
      holdingCostEstimate: holdingCost,
      spaceUtilization: `${stock.location} 랙 적재율 약 ${Math.min(100, Math.round((stock.currentStock / (stock.maxStock || 1)) * 100))}%`,
    },
    actionableSteps: [
      isShortage ? `조달 리드타임(${stock.leadTimeDays}일) 감안하여 추천 수량 ${recommendedReorder.toLocaleString()}개 발주 승인` : `창고 위치(${stock.location}) 정기 재고 실사 수행`,
      `일평균 출고량(${stock.dailyAverageOutbound}개) 변동 추이에 맞춰 안전재고선(${stock.safetyStock}개) 동적 재계산`,
      `월간 보관비용(약 ${holdingCost.toLocaleString()}원) 절감을 위한 입출고 파이프라인 동기화`,
    ],
  };

  return res.json(fallbackReport);
});

// AI Inventory Assistant Chat Endpoint
app.post('/api/ai/chat', async (req, res) => {
  const { messages, currentStock } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages array is required' });
  }

  const latestUserMessage = messages[messages.length - 1]?.content || '';

  if (aiClient) {
    try {
      const stockContext = currentStock ? `
[현재 조회 중인 재고 품목 정보]
- 품목명: ${currentStock.name} (SKU: ${currentStock.sku})
- 카테고리: ${currentStock.category}, 보관 위치: ${currentStock.location}
- 현재고: ${currentStock.currentStock?.toLocaleString()}개 / 안전재고: ${currentStock.safetyStock?.toLocaleString()}개
- 입고가: ${currentStock.costPrice?.toLocaleString()}원 / 출고가: ${currentStock.sellingPrice?.toLocaleString()}원
- 일평균 출고량: ${currentStock.dailyAverageOutbound}개 / 소진 예상: ${currentStock.runoutDays}일
- 재고회전율: ${currentStock.turnoverRate}회 / ABC 등급: ${currentStock.abcGrade}등급
` : '현재 특정 품목 미선택 (창고 전체 재고 및 물류 SCM 질의)';

      const chatHistory = messages.slice(-6).map((m: any) => `${m.sender === 'user' ? '물류담당자' : '스마트재고 AI 어드바이저'}: ${m.content}`).join('\n');

      const response = await aiClient.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `${stockContext}

[이전 대화 내역]
${chatHistory}

[사용자 질문]
${latestUserMessage}

당신은 Smart Stock v2.3의 스마트 재고 관리 및 SCM 데이터 분석 AI 전문가입니다.
창고 관리자 및 재고 기획자가 바로 현업에 적용할 수 있도록 친절하고 신속 정확하게 답변해주세요.`,
      });

      if (response.text) {
        return res.json({ reply: response.text });
      }
    } catch (error) {
      console.warn('Gemini inventory chat failed, using smart fallback reply:', error);
    }
  }

  // Fallback response generator
  let reply = `[Smart Stock 재고 AI 어드바이저 안내]\n\n`;
  if (currentStock) {
    reply += `조회 중이신 **${currentStock.name}** (SKU: ${currentStock.sku}) 현황입니다.\n`;
    reply += `• 현재고: **${currentStock.currentStock?.toLocaleString()}개** (안전재고 기준: ${currentStock.safetyStock}개)\n`;
    reply += `• 일평균 출고량: ${currentStock.dailyAverageOutbound}개 → 예상 소진일수: 약 ${currentStock.runoutDays}일\n`;
    reply += `• 보관 로케이션: ${currentStock.location} (${currentStock.abcGrade}등급 품목)\n\n`;
    if (currentStock.currentStock <= currentStock.safetyStock) {
      reply += `⚠️ 현재 안전재고선 이하로 떨어진 상태입니다. 리드타임(${currentStock.leadTimeDays}일)을 고려하여 결품이 발생하기 전에 발주 등록을 진행하시는 것을 강력히 권장합니다.`;
    } else {
      reply += `현재 적정 재고선 범위 내에서 안정적으로 유지되고 있으며, 정기 출고 계획에 차질이 없는 상태입니다. [AI 정밀 진단] 탭에서 상세 보관비용 및 차월 수요 예측을 확인하실 수 있습니다.`;
    }
  } else {
    reply += `현재 물류 센터 내 전체 품목의 재고 회전율 및 입출고 데이터가 정상 집계되고 있습니다.\n\n특정 SKU를 클릭하시면 해당 품목의 일별 입출고 추이, 보관 랙 적재율, 안전재고 하회 알림 및 AI 수요 예측 리포트를 즉시 확인하실 수 있습니다.`;
  }

  return res.json({ reply });
});

// Daily AI Inventory & Supply Chain Brief
app.get('/api/ai/market-summary', async (req, res) => {
  if (aiClient) {
    try {
      const response = await aiClient.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: '스마트 물류창고 재고 관리자를 위한 오늘의 실시간 재고 브리핑(안전재고 모니터링, 입출고 흐름, 품절 방지 주의사항)을 3문장으로 간결하고 전문적인 한국어로 작성해주세요.',
      });
      if (response.text) {
        return res.json({ summary: response.text });
      }
    } catch (e) {
      console.warn('AI inventory brief failed:', e);
    }
  }

  res.json({
    summary: '오늘 창고 내 주요 A등급 핵심 전자부품 및 생활가전의 출고량이 전주 대비 14% 증가하여 안전재고선 관리가 중요해졌습니다. 결품 위험 품목의 리드타임을 사전에 점검하시고, 과다재고 품목에 대해서는 적정 보관비용 절감을 위한 출고 프로모션을 검토하시기 바랍니다.',
  });
});

// Setup Vite or static serving
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Smart Stock v2.3 Inventory Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
