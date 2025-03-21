import * as cdk from 'aws-cdk-lib';
import * as lambdanode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as path from 'path';

export class DistributiveSystemAssignment1Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    
    const booksTable = new dynamodb.Table(this, 'BooksTable', {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: 'Author', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'ISBN', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: 'Books',
    });

    const addBookLambda = new lambdanode.NodejsFunction(this, 'AddBookLambda', {
      entry: path.join(__dirname, '../lambdas/addBook.ts'),
      handler: 'handler',
      environment: { TABLE_NAME: booksTable.tableName },
       });

       const getBooksLambda = new lambdanode.NodejsFunction(this, 'GetBooksLambda', {
        entry: path.join(__dirname, '../lambdas/getBooks.ts'),
        handler: 'handler',
        environment: { TABLE_NAME: booksTable.tableName },
      });
      
      const updateBookLambda = new lambdanode.NodejsFunction(this, 'UpdateBookLambda', {
        entry: path.join(__dirname, '../lambdas/updateBook.ts'),
        handler: 'handler',
        environment: { TABLE_NAME: booksTable.tableName },
      });
      
  }
}
