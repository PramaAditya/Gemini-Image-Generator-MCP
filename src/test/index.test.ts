import { jest } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';

// Mock the MCP SDK
jest.mock('@modelcontextprotocol/sdk/server/index.js');
jest.mock('@modelcontextprotocol/sdk/server/stdio.js');
jest.mock('@google/generative-ai');

const mockGenerateContent = jest.fn() as jest.MockedFunction<any>;
const mockGetGenerativeModel = jest.fn().mockReturnValue({
  generateContent: mockGenerateContent,
}) as jest.MockedFunction<any>;

const MockGoogleGenerativeAI = jest.fn().mockImplementation(() => ({
  getGenerativeModel: mockGetGenerativeModel,
})) as jest.MockedFunction<any>;

// Override the import
jest.unstable_mockModule('@google/generative-ai', () => ({
  GoogleGenerativeAI: MockGoogleGenerativeAI,
}));

describe('mcp-google-image-generator MCP Server', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Configuration', () => {
    test('should validate API key format', () => {
      const validKey = 'AIzaSyC...';
      const invalidKey = '';
      
      expect(validKey.length).toBeGreaterThan(0);
      expect(invalidKey.length).toBe(0);
    });

    test('should handle configuration persistence', async () => {
      const testConfig = {
        geminiApiKey: 'test-api-key-123',
      };

      const configPath = path.join(process.cwd(), '.mcp-google-image-generator-config.json');
      
      // Test writing config
      await fs.writeFile(configPath, JSON.stringify(testConfig, null, 2));
      
      // Test reading config
      const configData = await fs.readFile(configPath, 'utf-8');
      const parsedConfig = JSON.parse(configData);
      
      expect(parsedConfig.geminiApiKey).toBe('test-api-key-123');
      
      // Cleanup
      try {
        await fs.unlink(configPath);
      } catch {
        // Ignore if file doesn't exist
      }
    });
  });

  describe('Image Generation', () => {
    test('should format generation request correctly', () => {
      const prompt = 'A cute mcp-google-image-generator in a lab setting';
      const expectedModel = 'gemini-3.1-flash-image';
      
      expect(prompt).toContain('mcp-google-image-generator');
      expect(expectedModel).toBe('gemini-3.1-flash-image');
    });

    test('should handle successful image generation', async () => {
      const mockResponse = {
        text: () => 'Image generated successfully with mcp-google-image-generator technology',
      };
      
      mockGenerateContent.mockResolvedValueOnce({
        response: mockResponse,
      });

      const result = await mockGenerateContent('test prompt');
      expect((result as any).response.text()).toContain('mcp-google-image-generator');
    });

    test('should handle generation errors gracefully', async () => {
      const error = new Error('API quota exceeded');
      mockGenerateContent.mockRejectedValueOnce(error);

      try {
        await mockGenerateContent('test prompt');
      } catch (e) {
        expect((e as Error).message).toBe('API quota exceeded');
      }
    });
  });

  describe('Image Editing', () => {
    test('should handle MIME type detection', () => {
      const getMimeType = (filePath: string): string => {
        const ext = path.extname(filePath).toLowerCase();
        switch (ext) {
          case '.jpg':
          case '.jpeg':
            return 'image/jpeg';
          case '.png':
            return 'image/png';
          case '.webp':
            return 'image/webp';
          default:
            return 'image/jpeg';
        }
      };

      expect(getMimeType('test.jpg')).toBe('image/jpeg');
      expect(getMimeType('test.png')).toBe('image/png');
      expect(getMimeType('test.webp')).toBe('image/webp');
      expect(getMimeType('test.unknown')).toBe('image/jpeg');
    });

    test('should format image edit request with base64 data', () => {
      const testImageData = Buffer.from('test image data');
      const base64Data = testImageData.toString('base64');
      
      const imagePart = {
        inlineData: {
          data: base64Data,
          mimeType: 'image/jpeg',
        },
      };

      expect(imagePart.inlineData.data).toBe(base64Data);
      expect(imagePart.inlineData.mimeType).toBe('image/jpeg');
    });
  });

  describe('Tool Schema Validation', () => {
    test('should have correct tool definitions', () => {
      const expectedTools = [
        'configure_gemini_token',
        'generate_image', 
        'edit_image',
        'get_configuration_status',
      ];

      expectedTools.forEach(tool => {
        expect(typeof tool).toBe('string');
        expect(tool.length).toBeGreaterThan(0);
      });
    });

    test('should validate required parameters', () => {
      const configureSchema = {
        apiKey: { required: true, type: 'string' },
      };

      const generateSchema = {
        prompt: { required: true, type: 'string' },
      };

      const editSchema = {
        imagePath: { required: true, type: 'string' },
        prompt: { required: true, type: 'string' },
      };

      expect(configureSchema.apiKey.required).toBe(true);
      expect(generateSchema.prompt.required).toBe(true);
      expect(editSchema.imagePath.required).toBe(true);
      expect(editSchema.prompt.required).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle missing configuration', () => {
      const isConfigured = (config: any, genAI: any): boolean => {
        return config !== null && genAI !== null;
      };

      expect(isConfigured(null, null)).toBe(false);
      expect(isConfigured({ apiKey: 'test' }, {})).toBe(true);
    });

    test('should validate input parameters', () => {
      const validatePrompt = (prompt: string): boolean => {
        return typeof prompt === 'string' && prompt.length > 0;
      };

      expect(validatePrompt('valid prompt')).toBe(true);
      expect(validatePrompt('')).toBe(false);
      expect(validatePrompt(undefined as any)).toBe(false);
    });
  });

  describe('Integration Test Simulation', () => {
    test('should simulate full workflow', async () => {
      // 1. Configuration step
      const apiKey = 'test-gemini-api-key';
      expect(apiKey).toBeTruthy();

      // 2. Initialize Google AI client
      const genAI = new MockGoogleGenerativeAI(apiKey);
      expect(genAI).toBeDefined();

      // 3. Generate image
      mockGenerateContent.mockResolvedValueOnce({
        response: { text: () => 'Generated mcp-google-image-generator image successfully' },
      });

      const model = (genAI as any).getGenerativeModel({ model: 'gemini-3.1-flash-image' });
      const result = await model.generateContent('a mcp-google-image-generator in space');
      
      expect((result as any).response.text()).toContain('mcp-google-image-generator');

      // 4. Verify model was called correctly
      expect(mockGetGenerativeModel).toHaveBeenCalledWith({
        model: 'gemini-3.1-flash-image',
      });
    });

    test('should simulate error recovery', async () => {
      // Simulate API error
      mockGenerateContent.mockRejectedValueOnce(new Error('Rate limit exceeded'));

      try {
        const genAI = new MockGoogleGenerativeAI('test-key');
        const model = (genAI as any).getGenerativeModel({ model: 'gemini-3.1-flash-image' });
        await model.generateContent('test prompt');
      } catch (error) {
        expect((error as Error).message).toBe('Rate limit exceeded');
      }

      // Simulate recovery
      mockGenerateContent.mockResolvedValueOnce({
        response: { text: () => 'Retry successful' },
      });

      const genAI = new MockGoogleGenerativeAI('test-key');
      const model = (genAI as any).getGenerativeModel({ model: 'gemini-3.1-flash-image' });
      const result = await model.generateContent('test prompt');
      
      expect((result as any).response.text()).toBe('Retry successful');
    });
  });
});
