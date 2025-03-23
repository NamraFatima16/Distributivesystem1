import { Construct } from 'constructs';
import { books } from '../seed/books';
import { generateBatch } from '../shared/util';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as custom from "aws-cdk-lib/custom-resources";
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';


export class DistributiveSystemAssignment1Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);


    // Create table for books 
    const booksTable = new dynamodb.Table(this, 'BooksTable', {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: {
        name: 'Genre', type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'ISBN', type: dynamodb.AttributeType.STRING
      },
      tableName: 'BooksTable',
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    // custom resource for seeding the books table
    new custom.AwsCustomResource(this, 'booksSeedData', {
      onCreate: {
        service: 'DynamoDB',
        action: 'BatchWriteItem',
        parameters: {
          RequestItems: {
            [booksTable.tableName]: generateBatch(books)
          }
        },
        physicalResourceId: custom.PhysicalResourceId.of('bookSeedData')
      },
      policy: custom.AwsCustomResourcePolicy.fromSdkCalls({
        resources: [booksTable.tableArn]
      })
    });



    //Lambda funtion integration
    const getBooksByGenreFn = new lambda.NodejsFunction(this, 'GetBooksByGenreLambda', {
      entry: path.join(__dirname, '../lambdas/getBooksByGenre.ts'),
      handler: 'handler',
      environment: {
        TABLE_NAME: booksTable.tableName
      }
    })



    // permissions for lambda funtions
    booksTable.grantReadData(getBooksByGenreFn)




    //Api gateway implementation
    const apiGW = new apigateway.RestApi(this, 'BooksApi', {
      restApiName: "BooksAppApi",
      deployOptions: {
        stageName: "dev",
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true
      },
      defaultCorsPreflightOptions: {
        allowHeaders: ["Content-Type", "X-Amz-Date"],
        allowMethods: ["GET", "POST", "PUT"],
        allowCredentials: true,
        allowOrigins: ["*"],
      },
      apiKeySourceType: apigateway.ApiKeySourceType.HEADER
    });



    const bookApiKey = new apigateway.ApiKey(this, "addBookApiKey", {
      description: 'Api key for POST and PUT methods to write and update books in DB',
      enabled: true
    })

    const usagePlan = new apigateway.UsagePlan(this, 'BookApiUsagePlan', {
      name: 'apiUsagePlan',
      description: 'Usage plan for the book API',
      throttle: {
        rateLimit: 1000,
        burstLimit: 200,
      },
      apiStages: [
        {
          api: apiGW,
          stage: apiGW.deploymentStage
        }
      ]
    });
    usagePlan.addApiKey(bookApiKey)


    new cdk.CfnOutput(this, 'BookApiKeyId', {
      value: bookApiKey.keyId,
      description: 'ID of the API key for accessing book endpoints',
    });
  }
}