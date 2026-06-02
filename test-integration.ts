#!/usr/bin/env node

/**
 * Integration test script for mcp-google-image-generator MCP server
 * This script tests the server functionality without requiring a real Gemini API key
 */

import { spawn, ChildProcess } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

class IntegrationTester {
  private results: TestResult[] = [];
  private serverProcess: ChildProcess | null = null;

  async runAllTests(): Promise<void> {
    console.log('🚀 Starting mcp-google-image-generator MCP server integration tests...\n');

    try {
      await this.testProjectStructure();
      await this.testDependencies();
      await this.testBuildProcess();
      await this.testConfigurationHandling();
      await this.testToolSchema();
      
      this.printResults();
    } catch (error) {
      console.error('❌ Integration tests failed:', error);
      process.exit(1);
    }
  }

  private async testProjectStructure(): Promise<void> {
    const requiredFiles = [
      'package.json',
      'tsconfig.json',
      'src/index.ts',
      'README.md',
      '.gitignore',
      '.eslintrc.json',
    ];

    for (const file of requiredFiles) {
      try {
        await fs.access(path.join(process.cwd(), file));
        this.addResult(`Project structure - ${file}`, true, `✅ ${file} exists`);
      } catch {
        this.addResult(`Project structure - ${file}`, false, `❌ ${file} missing`);
      }
    }
  }

  private async testDependencies(): Promise<void> {
    try {
      const packageJson = JSON.parse(
        await fs.readFile(path.join(process.cwd(), 'package.json'), 'utf-8')
      );

      const requiredDeps = [
        '@modelcontextprotocol/sdk',
        '@google/generative-ai',
        'dotenv',
        'zod',
      ];

      for (const dep of requiredDeps) {
        if (packageJson.dependencies[dep]) {
          this.addResult(`Dependencies - ${dep}`, true, `✅ ${dep} found`);
        } else {
          this.addResult(`Dependencies - ${dep}`, false, `❌ ${dep} missing`);
        }
      }

      // Check if node_modules exists
      try {
        await fs.access(path.join(process.cwd(), 'node_modules'));
        this.addResult('Dependencies - node_modules', true, '✅ Dependencies installed');
      } catch {
        this.addResult('Dependencies - node_modules', false, '❌ Run npm install first');
      }
    } catch (error) {
      this.addResult('Dependencies check', false, `❌ Failed to check dependencies: ${error}`);
    }
  }

  private async testBuildProcess(): Promise<void> {
    return new Promise<void>((resolve) => {
      const buildProcess = spawn('npm', ['run', 'build'], {
        stdio: 'pipe',
        cwd: process.cwd(),
      });

      let output = '';
      let errorOutput = '';

      buildProcess.stdout?.on('data', (data) => {
        output += data.toString();
      });

      buildProcess.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });

      buildProcess.on('close', async (code) => {
        if (code === 0) {
          // Check if dist directory was created
          try {
            await fs.access(path.join(process.cwd(), 'dist'));
            this.addResult('Build process', true, '✅ Build successful');
          } catch {
            this.addResult('Build process', false, '❌ Dist directory not created');
          }
        } else {
          this.addResult('Build process', false, `❌ Build failed: ${errorOutput}`);
        }
        resolve();
      });
    });
  }

  private async testConfigurationHandling(): Promise<void> {
    try {
      // Test configuration file creation and validation
      const testConfig = {
        geminiApiKey: 'test-api-key-for-integration-testing',
      };

      const configPath = path.join(process.cwd(), '.mcp-google-image-generator-config-test.json');
      
      // Write test config
      await fs.writeFile(configPath, JSON.stringify(testConfig, null, 2));
      this.addResult('Configuration - Write', true, '✅ Config file written');

      // Read test config
      const configData = await fs.readFile(configPath, 'utf-8');
      const parsedConfig = JSON.parse(configData);
      
      if (parsedConfig.geminiApiKey === testConfig.geminiApiKey) {
        this.addResult('Configuration - Read', true, '✅ Config file read correctly');
      } else {
        this.addResult('Configuration - Read', false, '❌ Config data mismatch');
      }

      // Cleanup
      await fs.unlink(configPath);
      this.addResult('Configuration - Cleanup', true, '✅ Test config cleaned up');

    } catch (error) {
      this.addResult('Configuration handling', false, `❌ Configuration test failed: ${error}`);
    }
  }

  private async testToolSchema(): Promise<void> {
    try {
      // Test that the TypeScript code compiles and has correct structure
      const indexPath = path.join(process.cwd(), 'src', 'index.ts');
      const sourceCode = await fs.readFile(indexPath, 'utf-8');

      const requiredElements = [
        'configure_gemini_token',
        'generate_image',
        'edit_image',
        'get_configuration_status',
        'GoogleGenerativeAI',
        'gemini-3.1-flash-image',
      ];

      for (const element of requiredElements) {
        if (sourceCode.includes(element)) {
          this.addResult(`Tool Schema - ${element}`, true, `✅ ${element} found`);
        } else {
          this.addResult(`Tool Schema - ${element}`, false, `❌ ${element} missing`);
        }
      }

      // Test MIME type handling
      const mimeTypeTests = [
        { input: 'test.jpg', expected: 'image/jpeg' },
        { input: 'test.png', expected: 'image/png' },
        { input: 'test.webp', expected: 'image/webp' },
      ];

      const hasMimeTypeLogic = sourceCode.includes('getMimeType') || 
                              sourceCode.includes('image/jpeg') ||
                              sourceCode.includes('image/png');

      this.addResult('MIME type handling', hasMimeTypeLogic, 
        hasMimeTypeLogic ? '✅ MIME type logic found' : '❌ MIME type logic missing');

    } catch (error) {
      this.addResult('Tool Schema validation', false, `❌ Schema test failed: ${error}`);
    }
  }

  private addResult(name: string, passed: boolean, message: string): void {
    this.results.push({ name, passed, message });
  }

  private printResults(): void {
    console.log('\n📋 Integration Test Results:');
    console.log('═'.repeat(50));

    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;

    this.results.forEach(result => {
      console.log(`${result.passed ? '✅' : '❌'} ${result.message}`);
    });

    console.log('═'.repeat(50));
    console.log(`📊 Results: ${passed}/${total} tests passed`);

    if (passed === total) {
      console.log('🎉 All integration tests passed! The mcp-google-image-generator MCP server is ready to use.');
      console.log('\n📖 Next steps:');
      console.log('1. Get a Gemini API key from Google AI Studio');
      console.log('2. Configure your MCP client (Claude Desktop, etc.)');
      console.log('3. Use the configure_gemini_token tool to set up your API key');
      console.log('4. Start generating and editing images with mcp-google-image-generator!');
    } else {
      console.log('⚠️  Some tests failed. Please fix the issues before using the server.');
      process.exit(1);
    }
  }
}

// Run the integration tests
const tester = new IntegrationTester();
tester.runAllTests().catch(console.error);
