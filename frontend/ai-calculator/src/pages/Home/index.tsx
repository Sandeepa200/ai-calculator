import { ColorSwatch, Group, Slider } from '@mantine/core';
import { Button } from '@/components/ui/button';
import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import Draggable from 'react-draggable';
import { SWATCHES } from '@/constants';
import { FaEraser } from 'react-icons/fa';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface GeneratedResult {
    expression: string;
    answer: string;
}

interface Response {
    expr: string;
    result: string;
    assign: boolean;
}

declare global {
    interface Window {
        MathJax: any;
    }
}

export default function Home() {
    const [isLoading, setIsLoading] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState('rgb(255, 255, 255)');
    const [reset, setReset] = useState(false);
    const [dictOfVars, setDictOfVars] = useState({});
    const [result, setResult] = useState<GeneratedResult>();
    const [latexPosition, setLatexPosition] = useState({ x: 20, y: -800 });
    const [latexExpression, setLatexExpression] = useState<Array<string>>([]);
    const [brushSize, setBrushSize] = useState(3);
    const [isEraserActive, setIsEraserActive] = useState(false);

    useEffect(() => {
        if (latexExpression.length > 0 && window.MathJax) {
            setTimeout(() => {
                window.MathJax.Hub.Queue(["Typeset", window.MathJax.Hub]);
            }, 0);
        }
    }, [latexExpression]);

    useEffect(() => {
        if (result) {
            renderLatexToCanvas(result.expression, result.answer);
        }
    }, [result]);

    useEffect(() => {
        if (reset) {
            resetCanvas();
            setLatexExpression([]);
            setResult(undefined);
            setDictOfVars({});
            setReset(false);
        }
    }, [reset]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.lineCap = 'round';
                ctx.lineWidth = brushSize;
            }
        }

        if (!window.MathJax) {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.9/MathJax.js?config=TeX-MML-AM_CHTML';
            script.async = true;
            document.head.appendChild(script);

            script.onload = () => {
                window.MathJax.Hub.Config({
                    tex2jax: { inlineMath: [['$', '$'], ['\\(', '\\)']] },
                });
            };

            return () => {
                document.head.removeChild(script);
            };
        }
    }, [brushSize]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight - canvas.offsetTop;
                ctx.lineCap = 'round';
                ctx.lineWidth = brushSize;
            }
        }
    }, []);

    const renderLatexToCanvas = (expression: string, answer: string) => {
        const latex = `\\(\\LARGE{${expression} = ${answer}}\\)`;
        setLatexExpression([...latexExpression, latex]);

        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }
    };

    const resetCanvas = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing || isLoading) {
            return;
        }
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                if (isEraserActive) {
                    const x = e.nativeEvent.offsetX;
                    const y = e.nativeEvent.offsetY;
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2, true);
                    ctx.clip();
                    ctx.clearRect(x - brushSize, y - brushSize, brushSize * 2, brushSize * 2);
                    ctx.restore();
                } else {
                    ctx.strokeStyle = color;
                    ctx.lineWidth = brushSize;
                    ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
                    ctx.stroke();
                }
            }
        }
    };

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (isLoading) return;
        
        const canvas = canvasRef.current;
        if (canvas) {
            canvas.style.background = 'black';
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.beginPath();
                ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
                if (!isEraserActive) {
                    ctx.strokeStyle = color;
                    ctx.lineWidth = brushSize;
                }
                setIsDrawing(true);
            }
        }
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const runRoute = async () => {
        const canvas = canvasRef.current;

        if (canvas) {
            setIsLoading(true);
            try {
                const response = await axios({
                    method: 'post',
                    url: `${import.meta.env.VITE_API_URL}/calculate`,
                    data: {
                        image: canvas.toDataURL('image/png'),
                        dict_of_vars: dictOfVars
                    }
                });

                const resp = await response.data;
                console.log('Response', resp);
                resp.data.forEach((data: Response) => {
                    if (data.assign === true) {
                        setDictOfVars({
                            ...dictOfVars,
                            [data.expr]: data.result
                        });
                    }
                });

                const ctx = canvas.getContext('2d');
                const imageData = ctx!.getImageData(0, 0, canvas.width, canvas.height);
                let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;

                for (let y = 0; y < canvas.height; y++) {
                    for (let x = 0; x < canvas.width; x++) {
                        const i = (y * canvas.width + x) * 4;
                        if (imageData.data[i + 3] > 0) {  
                            minX = Math.min(minX, x);
                            minY = Math.min(minY, y);
                            maxX = Math.max(maxX, x);
                            maxY = Math.max(maxY, y);
                        }
                    }
                }

                setLatexPosition({ x: 20, y: -800 });
                resp.data.forEach((data: Response) => {
                    setTimeout(() => {
                        setResult({
                            expression: data.expr,
                            answer: data.result
                        });
                    }, 1000);
                });

                // Show success toast
                toast.success('Calculation Complete', {
                    description: 'Your calculation has been processed successfully.'
                });

            } catch (error: any) {
                console.error('Error:', error);
                toast.error('Calculation Error', {
                    description: error.response?.data?.message || 
                               'There was an error processing your calculation. Please try again.'
                });
            } finally {
                setIsLoading(false);
            }
        }
    };

    return (
        <>
            <div className='bg-black w-screen h-screen'>
                {/* Loading Overlay */}
                {isLoading && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                        <div className="flex flex-col items-center gap-4 bg-gray-800/80 p-8 rounded-lg">
                            <Loader2 className="w-12 h-12 text-white animate-spin" />
                            <p className="text-white text-lg font-medium">Processing calculation...</p>
                            <p className="text-gray-300 text-sm">Please wait while we analyze your input</p>
                        </div>
                    </div>
                )}

                <div className='absolute left-1/2 -translate-x-1/2 bg-gray-900/80 backdrop-blur-sm rounded-xl p-4 shadow-lg z-40'>
                    <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 items-center'>
                        <div className='flex flex-row gap-2'>
                            <Button
                                onClick={() => setReset(true)}
                                className='w-full bg-red-600 hover:bg-red-700 text-white transition-colors'
                                variant='destructive'
                                disabled={isLoading}
                            >
                                Reset Canvas
                            </Button>

                            <Button
                                onClick={() => setIsEraserActive(!isEraserActive)}
                                className={`w-full transition-colors ${
                                    isEraserActive
                                        ? 'bg-blue-500 hover:bg-blue-600'
                                        : 'bg-gray-700 hover:bg-gray-800'
                                }`}
                                disabled={isLoading}
                            >
                                <FaEraser size={20} className="mr-2" />
                                {isEraserActive ? 'Eraser On' : 'Eraser Off'}
                            </Button>
                        </div>

                        <div>
                            <div className='w-full bg-gray-800/50 rounded-lg p-3'>
                                <Slider
                                    value={brushSize}
                                    onChange={setBrushSize}
                                    min={1}
                                    max={20}
                                    step={1}
                                    label={(value) => `Size: ${value}px`}
                                    className='w-full'
                                    styles={{
                                        track: { backgroundColor: '#4B5563' },
                                        thumb: { borderColor: '#3B82F6' },
                                        bar: { backgroundColor: '#3B82F6' }
                                    }}
                                    disabled={isLoading}
                                />
                            </div>

                            <Button
                                onClick={runRoute}
                                className='w-full bg-green-600 hover:bg-green-700 text-white transition-colors'
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Calculating...
                                    </>
                                ) : (
                                    'Calculate'
                                )}
                            </Button>
                        </div>

                        <div className='w-full sm:col-span-2 p-2 bg-gray-800/50 rounded-lg'>
                            <Group className='flex justify-center gap-2'>
                                {SWATCHES.map((swatch) => (
                                    <ColorSwatch
                                        key={swatch}
                                        color={swatch}
                                        onClick={() => !isLoading && setColor(swatch)}
                                        className={`cursor-pointer transform hover:scale-110 transition-transform ${
                                            isLoading ? 'opacity-50 cursor-not-allowed' : ''
                                        }`}
                                        size={24}
                                    />
                                ))}
                            </Group>
                        </div>
                    </div>
                </div>

                <div className='absolute top-0 left-0 w-full h-full'>
                    <canvas
                        ref={canvasRef}
                        id='canvas'
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseOut={stopDrawing}
                        className={isLoading ? 'cursor-not-allowed' : ''}
                    />

                    {latexExpression && latexExpression.map((latex, index) => (
                        <Draggable
                            key={index}
                            defaultPosition={latexPosition}
                            onStop={(_, data) => setLatexPosition({ x: data.x, y: data.y })}
                            disabled={isLoading}
                        >
                            <div className="absolute p-2 text-white rounded shadow-md">
                                <div className="latex-content">{latex}</div>
                            </div>
                        </Draggable>
                    ))}
                </div>
            </div>
        </>
    );
}